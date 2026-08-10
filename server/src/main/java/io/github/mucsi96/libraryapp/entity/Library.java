package io.github.mucsi96.libraryapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A library branch the user can pick when importing an item. The id is a
 * slug of the name, so the API reads {@code /libraries/sihlcity} rather
 * than an opaque number.
 */
@Entity
@Table(name = "libraries", schema = "library")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Library {

  @Id
  private String id;

  @Column(nullable = false, unique = true)
  private String name;
}
