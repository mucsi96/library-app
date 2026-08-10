package io.github.mucsi96.libraryapp.service;

import java.time.LocalDate;
import java.util.List;

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
      item.setStatus(switch (item.getStatus()) {
        case LOANED, UNREAD_RETURNED -> LoanStatus.READING;
        case READ_RETURNED -> LoanStatus.READ;
        default -> item.getStatus();
      });
    } else {
      if (item.getLibrary() == null) {
        item.setDueDate(LocalDate.now().plusDays(loanPeriodDays));
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
          // A re-import means the item is borrowed again: returned
          // statuses map back to their on-loan equivalents so read
          // progress is kept.
          existing.setStatus(switch (existing.getStatus()) {
            case READ_RETURNED -> LoanStatus.READ;
            case UNREAD_RETURNED -> LoanStatus.LOANED;
            default -> existing.getStatus();
          });
          return existing;
        })
        .orElseGet(() -> LoanItem.builder()
            .isbn(isbn13)
            .mediaType(extracted.mediaType())
            .title(extracted.title())
            .author(extracted.author())
            .library(library)
            .dueDate(dueDate)
            // An owned item was never loaned; it starts as being read.
            .status(library == null ? LoanStatus.READING : LoanStatus.LOANED)
            .build()));
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
