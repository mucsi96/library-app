package io.github.mucsi96.libraryapp.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import io.github.mucsi96.libraryapp.entity.ImportJob;
import io.github.mucsi96.libraryapp.entity.LoanItem;
import io.github.mucsi96.libraryapp.model.ExtractedItem;
import io.github.mucsi96.libraryapp.model.PhotoData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs the AI half of an import off the request thread: one job at a time,
 * paced cluster-wide, so a queue of items can never burst past the
 * provider's rate limit.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ImportJobWorker {

  static final String NO_ISBN_DETAIL = "No valid ISBN found on the photos. Retake them with the barcode on the back clearly visible.";
  static final String UNPROCESSABLE_DETAIL = "The photos could not be processed. Retake them and try again.";

  private final ImportJobQueue importJobQueue;
  private final ImportJobService importJobService;
  private final ItemExtractionService itemExtractionService;
  private final ThumbnailService thumbnailService;
  private final LoanItemService loanItemService;

  @Scheduled(fixedDelayString = "${import.poll-interval}")
  public void pollQueue() {
    importJobQueue.claimNext().ifPresent(this::process);
  }

  @Scheduled(fixedDelayString = "${import.sweep-interval}")
  public void sweep() {
    importJobQueue.requeueStale()
        .forEach(job -> log.warn("Requeued stale import job {}", job.getReference()));

    importJobQueue.takeExpired().forEach(importJobService::deletePhotos);
  }

  private void process(ImportJob job) {
    try {
      PhotoData front = importJobService.loadPhoto(job.getFrontPhoto());
      PhotoData back = importJobService.loadPhoto(job.getBackPhoto());

      ExtractedItem extracted = itemExtractionService.extract(front, back);

      String isbn13 = IsbnValidator.toIsbn13(extracted.isbn())
          .orElseThrow(() -> new PermanentImportException(NO_ISBN_DETAIL));

      // Recorded before the cover call so the client can name the item
      // while the picture is still being drawn.
      importJobQueue.recordExtraction(job.getId(), extracted, isbn13);

      thumbnailService.ensureThumbnail(isbn13, front);

      LoanItem item = loanItemService.upsertFromExtraction(isbn13, extracted);

      importJobQueue.complete(job.getId(), item.getId());
      importJobService.deletePhotos(job);
    } catch (PermanentImportException e) {
      importJobQueue.fail(job.getId(), e.getMessage());
    } catch (RuntimeException e) {
      handleFailure(job, e);
    }
  }

  private void handleFailure(ImportJob job, RuntimeException failure) {
    if (ImportFailures.isTransient(failure)) {
      log.warn("Import job {} hit a transient failure, backing off", job.getReference(), failure);
      importJobQueue.scheduleRetry(job.getId(), ImportFailures.retryAfter(failure));
      return;
    }

    log.error("Import job {} failed", job.getReference(), failure);
    importJobQueue.fail(job.getId(), UNPROCESSABLE_DETAIL);
  }
}
