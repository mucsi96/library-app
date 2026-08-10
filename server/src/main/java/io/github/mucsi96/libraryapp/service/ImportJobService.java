package io.github.mucsi96.libraryapp.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.config.ImportProperties;
import io.github.mucsi96.libraryapp.entity.ImportJob;
import io.github.mucsi96.libraryapp.model.ImportJobResponse;
import io.github.mucsi96.libraryapp.model.ImportJobStatus;
import io.github.mucsi96.libraryapp.model.PhotoData;
import io.github.mucsi96.libraryapp.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;

/**
 * Owns import jobs as seen from the API: staging the photos, listing what
 * the client should still display, and the retry/dismiss actions on a
 * failed job. The AI work itself happens in {@link ImportJobWorker}.
 */
@Service
@RequiredArgsConstructor
public class ImportJobService {

  private final ImportJobRepository importJobRepository;
  private final FileStorageService fileStorageService;
  private final ImportProperties importProperties;
  private final LibraryService libraryService;

  /**
   * Stages both photos on disk and queues the job. Returns as soon as the
   * row is committed — no provider call happens on the request thread, so
   * the phone is free the moment the upload finishes.
   *
   * @param libraryId the picked library's slug, or null for an item the
   *                  user owns. Resolved to the display name here, so an
   *                  unknown id fails the upload instead of the job.
   */
  @Transactional
  public ImportJobResponse enqueue(MultipartFile front, MultipartFile back, String libraryId) {
    UUID reference = UUID.randomUUID();

    return toResponse(importJobRepository.save(ImportJob.builder()
        .reference(reference)
        .status(ImportJobStatus.QUEUED)
        .library(libraryId == null ? null : libraryService.requireName(libraryId))
        .frontPhoto(stagePhoto(reference, "front", front))
        .backPhoto(stagePhoto(reference, "back", back))
        .build()));
  }

  public List<ImportJobResponse> getVisibleJobs() {
    return importJobRepository
        .findVisible(Instant.now().minus(importProperties.completedVisibility()))
        .stream()
        .map(ImportJobService::toResponse)
        .toList();
  }

  public PhotoData getFrontPhoto(UUID reference) {
    ImportJob job = require(reference);

    if (!fileStorageService.exists(job.getFrontPhoto())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No photo for import: " + reference);
    }

    return loadPhoto(job.getFrontPhoto());
  }

  /**
   * Requeues a failed import. The photos are still staged, so the user
   * never has to take them again.
   */
  @Transactional
  public ImportJobResponse retry(UUID reference) {
    ImportJob job = require(reference);

    if (job.getStatus() != ImportJobStatus.FAILED) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a failed import can be retried.");
    }

    job.setStatus(ImportJobStatus.QUEUED);
    job.setAttempts(0);
    job.setErrorDetail(null);
    job.setNextAttemptAt(Instant.now());

    return toResponse(importJobRepository.save(job));
  }

  /**
   * Finishes an import whose photos yielded no readable ISBN. The typed
   * ISBN goes through the same validation as an extracted one, and the job
   * requeues to generate the cover from the staged photos.
   */
  @Transactional
  public ImportJobResponse submitIsbn(UUID reference, String isbn) {
    ImportJob job = require(reference);

    if (job.getStatus() != ImportJobStatus.NEEDS_ISBN) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This import is not waiting for an ISBN.");
    }

    String isbn13 = IsbnValidator.toIsbn13(isbn)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Not a valid ISBN. Check the digits and try again."));

    job.setIsbn(isbn13);
    job.setStatus(ImportJobStatus.QUEUED);
    job.setAttempts(0);
    job.setErrorDetail(null);
    job.setNextAttemptAt(Instant.now());

    return toResponse(importJobRepository.save(job));
  }

  @Transactional
  public void dismiss(UUID reference) {
    ImportJob job = require(reference);

    deletePhotos(job);
    importJobRepository.delete(job);
  }

  public PhotoData loadPhoto(String path) {
    return PhotoData.of(fileStorageService.fetchFile(path), PhotoData.contentTypeOf(path));
  }

  public void deletePhotos(ImportJob job) {
    fileStorageService.deleteFile(job.getFrontPhoto());
    fileStorageService.deleteFile(job.getBackPhoto());
  }

  public static ImportJobResponse toResponse(ImportJob job) {
    return new ImportJobResponse(
        job.getReference(),
        job.getStatus(),
        job.getIsbn(),
        job.getTitle(),
        job.getAuthor(),
        job.getMediaType(),
        job.getLibrary(),
        job.getLoanItemId(),
        job.getErrorDetail(),
        job.getCreatedAt());
  }

  private ImportJob require(UUID reference) {
    return importJobRepository.findByReference(reference)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Import not found: " + reference));
  }

  private String stagePhoto(UUID reference, String side, MultipartFile file) {
    final PhotoData photo;
    try {
      photo = PhotoData.of(file.getBytes(), file.getContentType());
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read uploaded photo: " + side, e);
    }

    // The extension carries the content type across the disk round-trip so
    // the model receives the format the camera produced.
    String path = "imports/%s-%s.%s".formatted(reference, side, photo.extension());
    fileStorageService.saveFile(photo.data(), path);

    return path;
  }
}
