package io.github.mucsi96.libraryapp.controller;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.libraryapp.model.ImportJobResponse;
import io.github.mucsi96.libraryapp.model.PhotoData;
import io.github.mucsi96.libraryapp.model.SubmitIsbnRequest;
import io.github.mucsi96.libraryapp.service.ImportJobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class ImportJobController {

  private final ImportJobService importJobService;

  @GetMapping("/import-jobs")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public List<ImportJobResponse> getImportJobs() {
    return importJobService.getVisibleJobs();
  }

  /**
   * The photo the user took, shown as the placeholder cover while the real
   * one is generated. Cached only briefly — it is deleted once the import
   * completes.
   */
  @GetMapping("/import-jobs/{reference}/photo")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public ResponseEntity<byte[]> getImportPhoto(@PathVariable UUID reference) {
    PhotoData photo = importJobService.getFrontPhoto(reference);

    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(photo.contentType()))
        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
        .body(photo.data());
  }

  @PostMapping("/import-jobs/{reference}/retry")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public ImportJobResponse retryImport(@PathVariable UUID reference) {
    return importJobService.retry(reference);
  }

  /** The manually typed ISBN for an import whose photos had no readable one. */
  @PostMapping("/import-jobs/{reference}/isbn")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public ImportJobResponse submitIsbn(
      @PathVariable UUID reference,
      @Valid @RequestBody SubmitIsbnRequest request) {
    return importJobService.submitIsbn(reference, request.isbn());
  }

  @DeleteMapping("/import-jobs/{reference}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public void dismissImport(@PathVariable UUID reference) {
    importJobService.dismiss(reference);
  }
}
