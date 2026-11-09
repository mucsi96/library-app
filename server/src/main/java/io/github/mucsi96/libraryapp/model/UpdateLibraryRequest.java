package io.github.mucsi96.libraryapp.model;

/**
 * @param library the id of a library from the predefined list, or null to
 *                make the item the user's own
 */
public record UpdateLibraryRequest(String library) {
}
