package io.github.mucsi96.libraryapp.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.libraryapp.entity.ImportJob;

public interface ImportJobRepository extends JpaRepository<ImportJob, Long> {

  Optional<ImportJob> findByReference(UUID reference);

  /**
   * Claims due jobs for this worker. {@code SKIP LOCKED} lets several
   * replicas poll the same table without ever handing the same job to two
   * workers, which is what keeps the provider call count bounded.
   */
  @Query(value = """
      SELECT * FROM library.import_jobs
      WHERE status = 'QUEUED' AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT :limit
      FOR UPDATE SKIP LOCKED
      """, nativeQuery = true)
  List<ImportJob> claimQueued(@Param("limit") int limit);

  /**
   * Everything the client should still see: unfinished and failed jobs
   * always, plus recently completed ones so the card can play its finish
   * transition before disappearing.
   */
  @Query("""
      SELECT job FROM ImportJob job
      WHERE job.status <> io.github.mucsi96.libraryapp.model.ImportJobStatus.COMPLETED
         OR job.updatedAt > :since
      ORDER BY job.createdAt ASC
      """)
  List<ImportJob> findVisible(@Param("since") Instant since);

  @Query("""
      SELECT job FROM ImportJob job
      WHERE job.status IN (
        io.github.mucsi96.libraryapp.model.ImportJobStatus.EXTRACTING,
        io.github.mucsi96.libraryapp.model.ImportJobStatus.GENERATING_COVER)
        AND job.updatedAt < :threshold
      """)
  List<ImportJob> findStale(@Param("threshold") Instant threshold);

  @Query("""
      SELECT job FROM ImportJob job
      WHERE job.status IN (
        io.github.mucsi96.libraryapp.model.ImportJobStatus.COMPLETED,
        io.github.mucsi96.libraryapp.model.ImportJobStatus.FAILED)
        AND job.updatedAt < :threshold
      """)
  List<ImportJob> findExpired(@Param("threshold") Instant threshold);
}
