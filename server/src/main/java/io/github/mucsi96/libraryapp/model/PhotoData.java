package io.github.mucsi96.libraryapp.model;

/**
 * An uploaded photo held in memory. Import photos outlive the request that
 * uploaded them, so they travel as bytes rather than as a
 * {@code MultipartFile} backed by a temp file the container will delete.
 */
public record PhotoData(byte[] data, String contentType) {

  private static final String DEFAULT_CONTENT_TYPE = "image/jpeg";

  /**
   * File extension to stage this photo under. The extension is how the
   * content type survives the round-trip through disk, so the same format
   * is sent to the model that the phone captured.
   */
  public String extension() {
    return switch (contentType) {
      case "image/png" -> "png";
      case "image/webp" -> "webp";
      case "image/heic" -> "heic";
      default -> "jpg";
    };
  }

  public static String contentTypeOf(String path) {
    return switch (path.substring(path.lastIndexOf('.') + 1)) {
      case "png" -> "image/png";
      case "webp" -> "image/webp";
      case "heic" -> "image/heic";
      default -> DEFAULT_CONTENT_TYPE;
    };
  }

  public static PhotoData of(byte[] data, String contentType) {
    return new PhotoData(data, contentType != null ? contentType : DEFAULT_CONTENT_TYPE);
  }
}
