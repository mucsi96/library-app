package io.github.mucsi96.libraryapp.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.content.Media;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;

import io.github.mucsi96.libraryapp.model.ExtractedItem;
import io.github.mucsi96.libraryapp.model.PhotoData;

// The structured-output converter behind entity(ExtractedItem.class) reads
// the record reflectively twice: victools walks its components to generate
// the JSON schema sent with the prompt, and Jackson binds the reply through
// the canonical constructor. Neither is visible to the framework's own AOT
// processing, so the native image needs the members registered by hand.
@Service
@RegisterReflectionForBinding(ExtractedItem.class)
public class ItemExtractionService {

  static final String SYSTEM_PROMPT = """
      You extract bibliographic data from photos of a book, CD or DVD.
      You receive two photos: the front and the back of the item.
      Read the ISBN printed near the barcode on the back.
      Return null for anything that is not clearly readable.
      """;

  private final ChatClient chatClient;

  public ItemExtractionService(ChatClient.Builder chatClientBuilder) {
    this.chatClient = chatClientBuilder.build();
  }

  public ExtractedItem extract(PhotoData front, PhotoData back) {
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

  private Media toMedia(PhotoData photo) {
    return Media.builder()
        .mimeType(MimeTypeUtils.parseMimeType(photo.contentType()))
        .data(new ByteArrayResource(photo.data()))
        .build();
  }
}
