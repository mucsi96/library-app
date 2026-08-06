package io.github.mucsi96.libraryapp.model;

import java.time.LocalDate;

public record LoanItemResponse(
    Long id,
    String barcode,
    String mediaType,
    String title,
    String author,
    String category,
    String library,
    LocalDate dueDate,
    String note,
    String isbn,
    String thumbnailUrl,
    boolean completed) {
}
