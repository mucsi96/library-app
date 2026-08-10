package io.github.mucsi96.libraryapp.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import io.github.mucsi96.libraryapp.entity.AiPacer;

public interface AiPacerRepository extends JpaRepository<AiPacer, Short> {

  /**
   * Reserves the next outbound AI slot. The row lock taken by the UPDATE
   * serialises every replica, and the {@code next_call_allowed_at} guard
   * makes the statement a no-op when the previous slot has not elapsed —
   * so this returns 1 at most once per interval cluster-wide.
   *
   * @return 1 when the caller may proceed, 0 when it must wait
   */
  @Modifying
  @Query(value = """
      UPDATE library.ai_pacer
      SET next_call_allowed_at = now() + interval '1 second' * :seconds
      WHERE id = 1 AND next_call_allowed_at <= now()
      """, nativeQuery = true)
  int tryAcquireSlot(@Param("seconds") double seconds);
}
