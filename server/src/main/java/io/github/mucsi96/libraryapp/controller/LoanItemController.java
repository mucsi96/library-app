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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.model.LoanItemResponse;
import io.github.mucsi96.libraryapp.model.UpdateCompletedRequest;
import io.github.mucsi96.libraryapp.service.LoanItemService;
import io.github.mucsi96.libraryapp.service.ThumbnailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class LoanItemController {
  private final LoanItemService loanItemService;
  private final ThumbnailService thumbnailService;

  @GetMapping("/items")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public List<LoanItemResponse> getItems() {
    return loanItemService.getItems();
  }

  @PostMapping("/items/import")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public LoanItemResponse importItem(
      @RequestParam("front") MultipartFile front,
      @RequestParam("back") MultipartFile back) {
    return loanItemService.importItem(front, back);
  }

  @PutMapping("/items/{id}/completed")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public LoanItemResponse setCompleted(@PathVariable Long id, @Valid @RequestBody UpdateCompletedRequest request) {
    return loanItemService.setCompleted(id, request.completed());
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
