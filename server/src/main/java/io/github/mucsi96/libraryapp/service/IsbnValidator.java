package io.github.mucsi96.libraryapp.service;

import java.util.Optional;
import java.util.stream.IntStream;

/**
 * Normalizes AI-extracted ISBNs to ISBN-13: strips separators, converts
 * ISBN-10, and verifies the 978/979 prefix and check digit.
 */
public final class IsbnValidator {

  private IsbnValidator() {
  }

  public static Optional<String> toIsbn13(String raw) {
    return Optional.ofNullable(raw)
        .map(value -> value.replaceAll("[\\s-]", ""))
        .map(digits -> digits.matches("\\d{9}[\\dXx]") ? convertIsbn10(digits) : digits)
        .filter(digits -> digits.matches("(978|979)\\d{10}"))
        .filter(IsbnValidator::hasValidCheckDigit);
  }

  private static String convertIsbn10(String isbn10) {
    String base = "978" + isbn10.substring(0, 9);
    return base + checkDigit(base);
  }

  private static boolean hasValidCheckDigit(String isbn13) {
    return isbn13.charAt(12) - '0' == checkDigit(isbn13.substring(0, 12));
  }

  private static int checkDigit(String first12Digits) {
    int sum = IntStream.range(0, 12)
        .map(i -> (first12Digits.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3))
        .sum();
    return (10 - sum % 10) % 10;
  }
}
