package io.github.mucsi96.libraryapp.service;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;

import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import com.openai.errors.OpenAIIoException;
import com.openai.errors.OpenAIRetryableException;
import com.openai.errors.OpenAIServiceException;

/**
 * Tells a rate limit or a hiccup apart from a request that will never
 * succeed. The two providers reach us through different stacks — the
 * official SDK for image edits, Spring's REST client for chat — so both
 * exception families are inspected along the whole cause chain.
 */
final class ImportFailures {

  private static final String RETRY_AFTER = "Retry-After";

  private ImportFailures() {
  }

  static boolean isTransient(Throwable failure) {
    for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
      if (cause instanceof OpenAIIoException
          || cause instanceof OpenAIRetryableException
          || cause instanceof ResourceAccessException
          || cause instanceof IOException) {
        return true;
      }

      if (cause instanceof OpenAIServiceException serviceException
          && isTransientStatus(serviceException.statusCode())) {
        return true;
      }

      if (cause instanceof RestClientResponseException responseException
          && isTransientStatus(responseException.getStatusCode().value())) {
        return true;
      }
    }

    return false;
  }

  /**
   * The provider's own advice on when to come back, preferred over our
   * exponential backoff when present.
   */
  static Optional<Duration> retryAfter(Throwable failure) {
    for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
      if (cause instanceof OpenAIServiceException serviceException) {
        Optional<Duration> advice = serviceException.headers().values(RETRY_AFTER).stream()
            .findFirst()
            .flatMap(ImportFailures::parseSeconds);

        if (advice.isPresent()) {
          return advice;
        }
      }

      if (cause instanceof RestClientResponseException responseException) {
        Optional<Duration> advice = Optional
            .ofNullable(responseException.getResponseHeaders())
            .map(headers -> headers.getFirst(RETRY_AFTER))
            .flatMap(ImportFailures::parseSeconds);

        if (advice.isPresent()) {
          return advice;
        }
      }
    }

    return Optional.empty();
  }

  private static boolean isTransientStatus(int status) {
    return status == 429 || status >= 500;
  }

  private static Optional<Duration> parseSeconds(String value) {
    try {
      return Optional.of(Duration.ofSeconds(Long.parseLong(value.trim())));
    } catch (NumberFormatException e) {
      // Retry-After may also be an HTTP date; the exponential backoff
      // covers that case well enough.
      return Optional.empty();
    }
  }
}
