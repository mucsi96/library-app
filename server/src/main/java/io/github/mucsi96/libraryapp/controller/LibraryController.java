package io.github.mucsi96.libraryapp.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.libraryapp.model.CreateLibraryRequest;
import io.github.mucsi96.libraryapp.model.LibraryResponse;
import io.github.mucsi96.libraryapp.service.LibraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class LibraryController {

  private final LibraryService libraryService;

  @GetMapping("/libraries")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public List<LibraryResponse> getLibraries() {
    return libraryService.getLibraries();
  }

  @PostMapping("/libraries")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public LibraryResponse createLibrary(@Valid @RequestBody CreateLibraryRequest request) {
    return libraryService.create(request.name());
  }

  @DeleteMapping("/libraries/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public void deleteLibrary(@PathVariable String id) {
    libraryService.delete(id);
  }
}
