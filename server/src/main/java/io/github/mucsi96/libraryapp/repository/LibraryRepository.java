package io.github.mucsi96.libraryapp.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.mucsi96.libraryapp.entity.Library;

public interface LibraryRepository extends JpaRepository<Library, String> {

  List<Library> findAllByOrderByNameAsc();
}
