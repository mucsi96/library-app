package io.github.mucsi96.libraryapp.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import io.github.mucsi96.libraryapp.entity.LoanItem;
import io.github.mucsi96.libraryapp.model.ExtractedItem;
import io.github.mucsi96.libraryapp.model.LoanItemResponse;
import io.github.mucsi96.libraryapp.model.LoanStatus;
import io.github.mucsi96.libraryapp.repository.LoanItemRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LoanItemService {
  private final LoanItemRepository loanItemRepository;
  private final LibraryService libraryService;

  @Value("${loan-period-days}")
  private int loanPeriodDays;

  public List<LoanItemResponse> getItems() {
    return loanItemRepository.findAllByOrderByDueDateAscTitleAsc().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public LoanItemResponse setStatus(Long id, LoanStatus status) {
    LoanItem item = loanItemRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found: " + id));

    item.setStatus(status);

    return toResponse(loanItemRepository.save(item));
  }

  /**
   * Gives every listed item the same due date. Own items have no return
   * deadline, so a selection holding one is rejected outright instead of
   * being applied to the rest.
   */
  @Transactional
  public List<LoanItemResponse> setDueDate(List<Long> ids, LocalDate dueDate) {
    List<LoanItem> items = loanItemRepository.findAllById(ids);

    if (items.size() != Set.copyOf(ids).size()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Some items were not found: " + ids);
    }

    if (items.stream().anyMatch(item -> item.getLibrary() == null)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Own items have no due date");
    }

    items.forEach(item -> item.setDueDate(dueDate));

    return loanItemRepository.saveAll(items).stream()
        .map(this::toResponse)
        .toList();
  }

  /**
   * Moves an item to another library branch, or — when {@code libraryId}
   * is null — to the user's own shelf. Own items have no due date and only
   * track reading progress, so moving there drops the loan bookkeeping; a
   * previously owned item becomes a fresh loan with a full loan period.
   */
  @Transactional
  public LoanItemResponse setLibrary(Long id, String libraryId) {
    LoanItem item = loanItemRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found: " + id));

    if (libraryId == null) {
      item.setLibrary(null);
      item.setDueDate(null);
      item.setStatus(toOwnStatus(item.getStatus()));
    } else {
      if (item.getLibrary() == null) {
        item.setDueDate(LocalDate.now().plusDays(loanPeriodDays));
        // An own item has a shelf status; borrowing it starts a loan.
        item.setStatus(toLoanedStatus(item.getStatus()));
      }
      item.setLibrary(libraryService.requireName(libraryId));
    }

    return toResponse(loanItemRepository.save(item));
  }

  /**
   * Records an extracted item against its ISBN. Re-importing a borrowed
   * item refreshes the loan without duplicating it or losing the read
   * status. Transactional so two queued jobs resolving to the same ISBN
   * cannot race the unique constraint.
   *
   * @param library the branch the user picked at import time, or null for
   *                an item they own — owned items have no due date.
   */
  @Transactional
  public LoanItem upsertFromExtraction(String isbn13, ExtractedItem extracted, String library) {
    LocalDate dueDate = library == null ? null : LocalDate.now().plusDays(loanPeriodDays);

    return loanItemRepository.save(loanItemRepository.findByIsbn(isbn13)
        .map(existing -> {
          existing.setMediaType(extracted.mediaType());
          existing.setTitle(extracted.title());
          existing.setAuthor(extracted.author());
          existing.setLibrary(library);
          existing.setDueDate(dueDate);
          // A re-import puts the item back on the picked shelf: statuses
          // map to their equivalents there so read progress is kept.
          existing.setStatus(library == null
              ? toOwnStatus(existing.getStatus())
              : toLoanedStatus(existing.getStatus()));
          return existing;
        })
        .orElseGet(() -> LoanItem.builder()
            .isbn(isbn13)
            .mediaType(extracted.mediaType())
            .title(extracted.title())
            .author(extracted.author())
            .library(library)
            .dueDate(dueDate)
            // An owned item was never loaned; it sits on the shelf
            // untouched until the user starts it.
            .status(library == null ? LoanStatus.UNREAD : LoanStatus.LOANED)
            .build()));
  }

  /**
   * Own items are never loaned or returned; anything not started becomes
   * unread and finished progress is kept.
   */
  private LoanStatus toOwnStatus(LoanStatus status) {
    return switch (status) {
      case LOANED, UNREAD_RETURNED -> LoanStatus.UNREAD;
      case READ_RETURNED -> LoanStatus.READ;
      default -> status;
    };
  }

  /**
   * A borrowed item carries loan statuses; anything not started becomes
   * loaned and finished progress is kept.
   */
  private LoanStatus toLoanedStatus(LoanStatus status) {
    return switch (status) {
      case UNREAD, UNREAD_RETURNED -> LoanStatus.LOANED;
      case READ_RETURNED -> LoanStatus.READ;
      default -> status;
    };
  }

  private LoanItemResponse toResponse(LoanItem item) {
    return new LoanItemResponse(
        item.getId(),
        item.getIsbn(),
        item.getMediaType(),
        item.getTitle(),
        item.getAuthor(),
        item.getLibrary(),
        item.getDueDate(),
        item.getStatus());
  }
}
