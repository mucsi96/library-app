package io.github.mucsi96.libraryapp.model;

import java.time.LocalDate;

public record LoanItemResponse(
    Long id,
    String isbn,
    String mediaType,
    String title,
    String author,
    String library,
    LocalDate dueDate,
    LoanStatus status) {
}
