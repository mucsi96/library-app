package io.github.mucsi96.libraryapp.model;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record ImportItemRequest(
    @NotBlank String barcode,
    @NotBlank @Pattern(regexp = "BOOK|CD") String mediaType,
    @NotBlank String title,
    String author,
    String category,
    @NotBlank String library,
    @NotNull LocalDate dueDate,
    String note) {
}
