package io.github.mucsi96.libraryapp.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
public class FileStorageService {

  @Value("${storage.directory}")
  private String storageDirectory;

  private Path storagePath;

  @PostConstruct
  void init() throws IOException {
    storagePath = Paths.get(storageDirectory).toAbsolutePath().normalize();
    Files.createDirectories(storagePath);
  }

  public boolean exists(String fileName) {
    return Files.exists(resolveFilePath(fileName));
  }

  public byte[] fetchFile(String fileName) {
    try {
      return Files.readAllBytes(resolveFilePath(fileName));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to fetch file: " + fileName, e);
    }
  }

  public void saveFile(byte[] data, String fileName) {
    try {
      Path filePath = resolveFilePath(fileName);
      Files.createDirectories(filePath.getParent());
      Files.write(filePath, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to save file: " + fileName, e);
    }
  }

  public void deleteFile(String fileName) {
    try {
      Files.deleteIfExists(resolveFilePath(fileName));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to delete file: " + fileName, e);
    }
  }

  private Path resolveFilePath(String fileName) {
    Path filePath = storagePath.resolve(fileName).normalize();

    if (!filePath.startsWith(storagePath)) {
      throw new IllegalArgumentException("Invalid file path: " + fileName);
    }

    return filePath;
  }
}
