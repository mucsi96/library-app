package io.github.mucsi96.libraryapp.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

  @Column(nullable = false, unique = true)
  private String barcode;

  @Column(name = "media_type", nullable = false)
  private String mediaType;

  @Column(nullable = false)
  private String title;

  private String author;

  private String category;

  @Column(nullable = false)
  private String library;

  @Column(name = "due_date", nullable = false)
  private LocalDate dueDate;

  private String note;

  @Column(nullable = false)
  private boolean completed;
}
