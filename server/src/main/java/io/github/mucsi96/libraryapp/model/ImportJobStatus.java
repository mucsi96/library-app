package io.github.mucsi96.libraryapp.model;

/**
 * Lifecycle of a photo import. The processing states are distinct so the
 * client can show what the AI is doing instead of an opaque spinner, and
 * so a job interrupted mid-flight can be recognised and requeued.
 */
public enum ImportJobStatus {
  QUEUED,
  EXTRACTING,
  GENERATING_COVER,
  COMPLETED,
  FAILED
}
