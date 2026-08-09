package io.github.mucsi96.libraryapp.entity;

import java.time.LocalDate;

import io.github.mucsi96.libraryapp.model.LoanStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "loan_items", schema = "library")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanItem {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(unique = true)
  private String isbn;

  @Column(name = "media_type", nullable = false)
  private String mediaType;

  @Column(nullable = false)
  private String title;

  private String author;

  private String library;

  @Column(name = "due_date", nullable = false)
  private LocalDate dueDate;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private LoanStatus status;
}
