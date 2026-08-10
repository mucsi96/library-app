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

  /**
   * Stages both photos on disk and queues the job. Returns as soon as the
   * row is committed — no provider call happens on the request thread, so
   * the phone is free the moment the upload finishes.
   */
  @Transactional
  public ImportJobResponse enqueue(MultipartFile front, MultipartFile back) {
    UUID reference = UUID.randomUUID();

    return toResponse(importJobRepository.save(ImportJob.builder()
        .reference(reference)
        .status(ImportJobStatus.QUEUED)
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
