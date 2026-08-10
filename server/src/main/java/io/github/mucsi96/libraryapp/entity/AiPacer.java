package io.github.mucsi96.libraryapp.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

/**
 * Single-row table pacing outbound AI calls across every replica. See
 * {@link io.github.mucsi96.libraryapp.repository.AiPacerRepository}.
 */
@Entity
@Table(name = "ai_pacer", schema = "library")
@Data
public class AiPacer {
  @Id
  private Short id;

  @Column(name = "next_call_allowed_at", nullable = false)
  private Instant nextCallAllowedAt;
}
