package io.github.mucsi96.libraryapp.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.github.mucsi96.libraryapp.model.ImportItemRequest;
import io.github.mucsi96.libraryapp.model.ImportResult;
import io.github.mucsi96.libraryapp.model.LoanItemResponse;
import io.github.mucsi96.libraryapp.model.UpdateCompletedRequest;
import io.github.mucsi96.libraryapp.service.LoanItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class LoanItemController {
  private final LoanItemService loanItemService;

  @GetMapping("/items")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_readItems')")
  public List<LoanItemResponse> getItems() {
    return loanItemService.getItems();
  }

  @PostMapping("/items/import")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public ImportResult importItems(@RequestBody List<@Valid ImportItemRequest> items) {
    return loanItemService.importItems(items);
  }

  @PutMapping("/items/{id}/completed")
  @PreAuthorize("hasAuthority('APPROLE_LibraryUser') and hasAuthority('SCOPE_writeItems')")
  public LoanItemResponse setCompleted(@PathVariable Long id, @Valid @RequestBody UpdateCompletedRequest request) {
    return loanItemService.setCompleted(id, request.completed());
  }
}
