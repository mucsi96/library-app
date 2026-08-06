package io.github.mucsi96.libraryapp.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.libraryapp.entity.LoanItem;

public interface LoanItemRepository extends JpaRepository<LoanItem, Long> {
  Optional<LoanItem> findByIsbn(String isbn);

  List<LoanItem> findAllByOrderByDueDateAscTitleAsc();
}
