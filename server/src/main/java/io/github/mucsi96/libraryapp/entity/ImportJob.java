package io.github.mucsi96.libraryapp.entity;

import java.time.Instant;
import java.util.UUID;

import io.github.mucsi96.libraryapp.model.ImportJobStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "import_jobs", schema = "library")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportJob {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Public identifier used in URLs so the surrogate key stays internal. */
  @Column(nullable = false, unique = true)
  private UUID reference;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ImportJobStatus status;

  @Column(name = "front_photo", nullable = false)
  private String frontPhoto;

  @Column(name = "back_photo", nullable = false)
  private String backPhoto;

  private String isbn;

  private String title;

  private String author;

  @Column(name = "media_type")
  private String mediaType;

  private String library;

  @Column(name = "loan_item_id")
  private Long loanItemId;

  @Column(name = "error_detail")
  private String errorDetail;

  @Column(nullable = false)
  private int attempts;

  @Column(name = "next_attempt_at", nullable = false)
  private Instant nextAttemptAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void onInsert() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;

    if (nextAttemptAt == null) {
      nextAttemptAt = now;
    }
  }

  @PreUpdate
  void touch() {
    updatedAt = Instant.now();
  }
}
