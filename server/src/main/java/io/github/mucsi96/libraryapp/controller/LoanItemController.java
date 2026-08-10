package io.github.mucsi96.libraryapp.controller;

import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.model.ImportJobResponse;
import io.github.mucsi96.libraryapp.model.LoanItemResponse;
import io.github.mucsi96.libraryapp.model.UpdateStatusRequest;
import io.github.mucsi96.libraryapp.service.ImportJobService;
import io.github.mucsi96.libraryapp.service.LoanItemService;
import io.github.mucsi96.libraryapp.service.ThumbnailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class LoanItemController {
  private final LoanItemService loanItemService;
  private final ThumbnailService thumbnailService;
  private final ImportJobService importJobService;

  @GetMapping("/items")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public List<LoanItemResponse> getItems() {
    return loanItemService.getItems();
  }

  /**
   * Queues an import. The photos are staged and the response returns
   * immediately, so the phone is free while the AI work happens in the
   * background — poll {@code /import-jobs} for progress. The user picks
   * where the item lives: a library from the predefined list, or — when
   * {@code library} is omitted — their own shelf.
   */
  @PostMapping("/items/import")
  @ResponseStatus(HttpStatus.ACCEPTED)
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public ImportJobResponse importItem(
      @RequestParam("front") MultipartFile front,
      @RequestParam("back") MultipartFile back,
      @RequestParam(value = "library", required = false) String libraryId) {
    return importJobService.enqueue(front, back, libraryId);
  }

  @PutMapping("/items/{id}/status")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public LoanItemResponse setStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest request) {
    return loanItemService.setStatus(id, request.status());
  }

  @GetMapping(value = "/thumbnails/{isbn:\\d{13}}", produces = MediaType.IMAGE_JPEG_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public ResponseEntity<byte[]> getThumbnail(@PathVariable String isbn) {
    if (!thumbnailService.hasThumbnail(isbn)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No thumbnail for ISBN: " + isbn);
    }

    // Thumbnails are generated once per ISBN and never replaced, so they
    // can be cached forever.
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
        .body(thumbnailService.fetchThumbnail(isbn));
  }
}
