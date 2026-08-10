package io.github.mucsi96.libraryapp.model;

import jakarta.validation.constraints.NotBlank;

public record SubmitIsbnRequest(@NotBlank String isbn) {
}
