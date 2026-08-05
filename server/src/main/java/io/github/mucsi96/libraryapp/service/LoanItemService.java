package io.github.mucsi96.libraryapp.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.entity.LoanItem;
import io.github.mucsi96.libraryapp.model.ImportItemRequest;
import io.github.mucsi96.libraryapp.model.ImportResult;
import io.github.mucsi96.libraryapp.model.LoanItemResponse;
import io.github.mucsi96.libraryapp.repository.LoanItemRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LoanItemService {
  private final LoanItemRepository loanItemRepository;

  public List<LoanItemResponse> getItems() {
    return loanItemRepository.findAllByOrderByDueDateAscTitleAsc().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ImportResult importItems(List<ImportItemRequest> items) {
    List<Boolean> results = items.stream()
        .map(this::upsertItem)
        .toList();

    int created = (int) results.stream().filter(isNew -> isNew).count();

    return new ImportResult(created, results.size() - created);
  }

  @Transactional
  public LoanItemResponse setCompleted(Long id, boolean completed) {
    LoanItem item = loanItemRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found: " + id));

    item.setCompleted(completed);

    return toResponse(loanItemRepository.save(item));
  }

  /** Inserts a new item or refreshes loan details on the existing one, returns true when the item was new. */
  private boolean upsertItem(ImportItemRequest request) {
    return loanItemRepository.findByBarcode(request.barcode())
        .map(existing -> {
          existing.setMediaType(request.mediaType());
          existing.setTitle(request.title());
          existing.setAuthor(request.author());
          existing.setCategory(request.category());
          existing.setLibrary(request.library());
          existing.setDueDate(request.dueDate());
          existing.setNote(request.note());
          loanItemRepository.save(existing);
          return false;
        })
        .orElseGet(() -> {
          loanItemRepository.save(LoanItem.builder()
              .barcode(request.barcode())
              .mediaType(request.mediaType())
              .title(request.title())
              .author(request.author())
              .category(request.category())
              .library(request.library())
              .dueDate(request.dueDate())
              .note(request.note())
              .completed(false)
              .build());
          return true;
        });
  }

  private LoanItemResponse toResponse(LoanItem item) {
    return new LoanItemResponse(
        item.getId(),
        item.getBarcode(),
        item.getMediaType(),
        item.getTitle(),
        item.getAuthor(),
        item.getCategory(),
        item.getLibrary(),
        item.getDueDate(),
        item.getNote(),
        item.isCompleted());
  }
}
