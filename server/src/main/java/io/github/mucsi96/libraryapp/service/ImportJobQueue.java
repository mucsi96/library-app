package io.github.mucsi96.libraryapp.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import io.github.mucsi96.libraryapp.config.ImportProperties;
import io.github.mucsi96.libraryapp.entity.ImportJob;
import io.github.mucsi96.libraryapp.model.ExtractedItem;
import io.github.mucsi96.libraryapp.model.ImportJobStatus;
import io.github.mucsi96.libraryapp.repository.AiPacerRepository;
import io.github.mucsi96.libraryapp.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;

/**
 * Every state transition of an import job, each in its own transaction so
 * the long provider calls in {@link ImportJobWorker} never hold a database
 * connection open.
 */
@Service
@RequiredArgsConstructor
public class ImportJobQueue {

  static final String BUSY_DETAIL = "The AI service was busy and the import kept failing. Tap retry to try again.";

  private final ImportJobRepository importJobRepository;
  private final AiPacerRepository aiPacerRepository;
  private final ImportProperties importProperties;

  /**
   * Takes the next due job, if one is due and the cluster-wide pace allows
   * it. {@code FOR UPDATE SKIP LOCKED} in the claim query means concurrent
   * replicas never pick the same job.
   */
  @Transactional
  public Optional<ImportJob> claimNext() {
    List<ImportJob> due = importJobRepository.claimQueued(1);

    if (due.isEmpty()) {
      return Optional.empty();
    }

    // Checked only once there is work, so an idle poll never burns the
    // slot and delays the next real import.
    if (aiPacerRepository.tryAcquireSlot(toSeconds(importProperties.minJobInterval())) == 0) {
      return Optional.empty();
    }

    ImportJob job = due.getFirst();
    job.setStatus(ImportJobStatus.EXTRACTING);

    return Optional.of(job);
  }

  @Transactional
  public void recordExtraction(Long jobId, ExtractedItem extracted, String isbn13) {
    ImportJob job = importJobRepository.findById(jobId).orElseThrow();

    job.setIsbn(isbn13);
    job.setTitle(extracted.title());
    job.setAuthor(extracted.author());
    job.setMediaType(extracted.mediaType());
    job.setLibrary(extracted.library());
    job.setStatus(ImportJobStatus.GENERATING_COVER);
  }

  @Transactional
  public void complete(Long jobId, Long loanItemId) {
    ImportJob job = importJobRepository.findById(jobId).orElseThrow();

    job.setLoanItemId(loanItemId);
    job.setStatus(ImportJobStatus.COMPLETED);
    job.setErrorDetail(null);
  }

  @Transactional
  public void fail(Long jobId, String detail) {
    ImportJob job = importJobRepository.findById(jobId).orElseThrow();

    job.setStatus(ImportJobStatus.FAILED);
    job.setErrorDetail(detail);
  }

  /**
   * Backs off and requeues a job that hit a rate limit or a transient
   * provider error, giving up once the attempts are spent.
   */
  @Transactional
  public void scheduleRetry(Long jobId, Optional<Duration> retryAfter) {
    ImportJob job = importJobRepository.findById(jobId).orElseThrow();
    int attempts = job.getAttempts() + 1;

    job.setAttempts(attempts);

    if (attempts >= importProperties.maxAttempts()) {
      job.setStatus(ImportJobStatus.FAILED);
      job.setErrorDetail(BUSY_DETAIL);
      return;
    }

    job.setStatus(ImportJobStatus.QUEUED);
    job.setNextAttemptAt(Instant.now().plus(retryAfter.orElseGet(() -> backoff(attempts))));
  }

  /** Requeues jobs whose worker died mid-flight. */
  @Transactional
  public List<ImportJob> requeueStale() {
    List<ImportJob> stale = importJobRepository
        .findStale(Instant.now().minus(importProperties.staleAfter()));

    stale.forEach(job -> {
      job.setStatus(ImportJobStatus.QUEUED);
      job.setNextAttemptAt(Instant.now());
    });

    return stale;
  }

  @Transactional
  public List<ImportJob> takeExpired() {
    List<ImportJob> expired = importJobRepository
        .findExpired(Instant.now().minus(importProperties.retention()));

    importJobRepository.deleteAll(expired);

    return expired;
  }

  private Duration backoff(int attempts) {
    long base = importProperties.retryBaseDelay().toMillis();
    long step = base << Math.min(attempts - 1, 16);
    long capped = Math.min(step, importProperties.retryMaxDelay().toMillis());

    // Jitter keeps several queued jobs from retrying in lockstep after a
    // shared rate limit.
    return Duration.ofMillis(capped + ThreadLocalRandom.current().nextLong(capped / 5 + 1));
  }

  private static double toSeconds(Duration duration) {
    return duration.toMillis() / 1000.0;
  }
}
