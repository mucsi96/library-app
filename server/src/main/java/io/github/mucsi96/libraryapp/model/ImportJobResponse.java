package io.github.mucsi96.libraryapp.model;

import java.time.Instant;
import java.util.UUID;

/**
 * An import in flight. Title and author are present from the moment
 * extraction succeeds, so the client can name the item while the cover is
 * still being drawn.
 */
public record ImportJobResponse(
    UUID reference,
    ImportJobStatus status,
    String isbn,
    String title,
    String author,
    String mediaType,
    String library,
    Long itemId,
    String errorDetail,
    Instant createdAt) {
}
