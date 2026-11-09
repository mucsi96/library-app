package io.github.mucsi96.libraryapp.model;

import jakarta.validation.constraints.NotBlank;

public record CreateLibraryRequest(@NotBlank String name) {
}
