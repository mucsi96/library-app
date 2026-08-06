package io.github.mucsi96.libraryapp.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Base64;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.openai.client.OpenAIClient;
import com.openai.core.MultipartField;
import com.openai.models.images.ImageEditParams;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ThumbnailService {

  static final String PROMPT = """
      Recreate this cover as a clean product image. Remove all library \
      markings: stickers, labels, barcodes and stamps. Keep the original \
      artwork, title and typography unchanged.""";

  private final OpenAIClient openAIClient;
  private final FileStorageService fileStorageService;

  public static String thumbnailFile(String isbn13) {
    return "thumbnails/%s.jpg".formatted(isbn13);
  }

  public boolean hasThumbnail(String isbn13) {
    return fileStorageService.exists(thumbnailFile(isbn13));
  }

  public byte[] fetchThumbnail(String isbn13) {
    return fileStorageService.fetchFile(thumbnailFile(isbn13));
  }

  /**
   * Generates the cleaned cover from the front photo. Skipped when the
   * ISBN already has one, so re-importing an item is free.
   */
  public void ensureThumbnail(String isbn13, MultipartFile front) {
    if (hasThumbnail(isbn13)) {
      return;
    }

    final ImageEditParams params;
    try {
      params = ImageEditParams.builder()
          // Filename and content type are set explicitly so the photo is
          // sent as a proper file part.
          .image(MultipartField.<ImageEditParams.Image>builder()
              .value(ImageEditParams.Image.ofInputStream(front.getInputStream()))
              .filename("front")
              .contentType(front.getContentType() != null ? front.getContentType() : "image/jpeg")
              .build())
          .prompt(PROMPT)
          .model("gpt-image-2")
          .size(ImageEditParams.Size.AUTO)
          .n(1)
          .outputFormat(ImageEditParams.OutputFormat.JPEG)
          .outputCompression(75)
          .build();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read front photo", e);
    }

    final byte[] thumbnail = openAIClient.images().edit(params).data().orElseThrow().stream()
        .flatMap(image -> image.b64Json().stream())
        .map(b64 -> Base64.getDecoder().decode(b64))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("No image data returned from OpenAI API"));

    fileStorageService.saveFile(thumbnail, thumbnailFile(isbn13));
  }
}
