package io.github.mucsi96.libraryapp.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
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
  private final ItemExtractionService itemExtractionService;
  private final ThumbnailService thumbnailService;

  @Value("${loan-period-days}")
  private int loanPeriodDays;

  public List<LoanItemResponse> getItems() {
    return loanItemRepository.findAllByOrderByDueDateAscTitleAsc().stream()
        .map(this::toResponse)
        .toList();
  }

  /**
   * Imports one borrowed item from its front and back photos: GPT extracts
   * the bibliographic data, the ISBN is validated, a cleaned cover
   * thumbnail is generated, and the item is upserted by ISBN so a
   * re-borrowed item refreshes its loan without losing the read status.
   */
  public LoanItemResponse importItem(MultipartFile front, MultipartFile back) {
    ExtractedItem extracted = itemExtractionService.extract(front, back);

    String isbn13 = IsbnValidator.toIsbn13(extracted.isbn())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "No valid ISBN found on the photos. Retake them with the barcode on the back clearly visible."));

    thumbnailService.ensureThumbnail(isbn13, front);

    return toResponse(upsertItem(isbn13, extracted));
  }

  @Transactional
  public LoanItemResponse setStatus(Long id, LoanStatus status) {
    LoanItem item = loanItemRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found: " + id));

    item.setStatus(status);

    return toResponse(loanItemRepository.save(item));
  }

  private LoanItem upsertItem(String isbn13, ExtractedItem extracted) {
    LocalDate dueDate = LocalDate.now().plusDays(loanPeriodDays);

    return loanItemRepository.save(loanItemRepository.findByIsbn(isbn13)
        .map(existing -> {
          existing.setMediaType(extracted.mediaType());
          existing.setTitle(extracted.title());
          existing.setAuthor(extracted.author());
          existing.setLibrary(extracted.library());
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
            .library(extracted.library())
            .dueDate(dueDate)
            .status(LoanStatus.LOANED)
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
