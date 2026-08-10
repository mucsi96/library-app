package io.github.mucsi96.libraryapp.model;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record ExtractedItem(
    @JsonPropertyDescription("ISBN-13 or ISBN-10 printed on the item, usually near the barcode on the back. Null when not readable.") String isbn,
    @JsonPropertyDescription("Title of the book or CD") String title,
    @JsonPropertyDescription("Author, composer or performer. Null when not visible.") String author,
    @JsonPropertyDescription("BOOK for printed media, CD for audio media") String mediaType) {
}
