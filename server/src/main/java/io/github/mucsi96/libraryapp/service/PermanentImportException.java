package io.github.mucsi96.libraryapp.service;

/**
 * The import cannot succeed however often it is retried — the photos
 * themselves are the problem. Carries the message shown to the user.
 */
public class PermanentImportException extends RuntimeException {
  public PermanentImportException(String message) {
    super(message);
  }
}
