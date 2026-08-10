package io.github.mucsi96.libraryapp.service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.entity.Library;
import io.github.mucsi96.libraryapp.model.LibraryResponse;
import io.github.mucsi96.libraryapp.repository.LibraryRepository;
import lombok.RequiredArgsConstructor;

/**
 * The predefined list of library branches the user picks from when
 * importing an item, managed on the settings page.
 */
@Service
@RequiredArgsConstructor
public class LibraryService {

  private final LibraryRepository libraryRepository;

  public List<LibraryResponse> getLibraries() {
    return libraryRepository.findAllByOrderByNameAsc().stream()
        .map(LibraryService::toResponse)
        .toList();
  }

  @Transactional
  public LibraryResponse create(String name) {
    String trimmed = name.trim();
    String slug = slugify(trimmed);

    if (slug.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "A library name needs at least one letter or digit.");
    }

    if (libraryRepository.existsById(slug)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "A library with this name already exists.");
    }

    return toResponse(libraryRepository.save(Library.builder()
        .id(slug)
        .name(trimmed)
        .build()));
  }

  @Transactional
  public void delete(String id) {
    if (!libraryRepository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Library not found: " + id);
    }

    libraryRepository.deleteById(id);
  }

  /** The display name for a picked library, rejecting unknown ids. */
  public String requireName(String id) {
    return libraryRepository.findById(id)
        .map(Library::getName)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown library: " + id));
  }

  private static String slugify(String name) {
    return Normalizer.normalize(name, Normalizer.Form.NFKD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", "-")
        .replaceAll("^-|-$", "");
  }

  private static LibraryResponse toResponse(Library library) {
    return new LibraryResponse(library.getId(), library.getName());
  }
}
