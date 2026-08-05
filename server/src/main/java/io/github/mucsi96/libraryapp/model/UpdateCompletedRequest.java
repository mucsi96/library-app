package io.github.mucsi96.libraryapp.model;

import jakarta.validation.constraints.NotNull;

public record UpdateCompletedRequest(
    @NotNull Boolean completed) {
}
