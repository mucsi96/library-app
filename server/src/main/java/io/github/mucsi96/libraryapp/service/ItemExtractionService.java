package io.github.mucsi96.libraryapp.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.content.Media;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.multipart.MultipartFile;

import io.github.mucsi96.libraryapp.model.ExtractedItem;

@Service
public class ItemExtractionService {

  static final String SYSTEM_PROMPT = """
      You extract bibliographic data from photos of a borrowed library item.
      You receive two photos: the front and the back of a book or CD.
      Read the ISBN printed near the barcode on the back.
      Read the library branch name from library stickers or stamps if present.
      Return null for anything that is not clearly readable.
      """;

  private final ChatClient chatClient;

  public ItemExtractionService(ChatClient.Builder chatClientBuilder) {
    this.chatClient = chatClientBuilder.build();
  }

  public ExtractedItem extract(MultipartFile front, MultipartFile back) {
    return chatClient
        .prompt()
        .system(SYSTEM_PROMPT)
        .user(user -> user
            .text("Here are the front and back photos of the item.")
            .media(toMedia(front))
            .media(toMedia(back)))
        .call()
        .entity(ExtractedItem.class);
  }

  private Media toMedia(MultipartFile photo) {
    return Media.builder()
        .mimeType(photo.getContentType() != null
            ? MimeTypeUtils.parseMimeType(photo.getContentType())
            : MimeTypeUtils.IMAGE_JPEG)
        .data(photo.getResource())
        .build();
  }
}
