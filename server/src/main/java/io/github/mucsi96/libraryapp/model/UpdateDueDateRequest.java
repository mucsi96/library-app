package io.github.mucsi96.libraryapp.model;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * Bulk due-date change for the items ticked in the loans list - typically
 * a stack renewed at the counter in one go.
 *
 * @param ids     the items to move; own items are rejected as they have no
 *                return deadline
 * @param dueDate the new deadline shared by all of them
 */
public record UpdateDueDateRequest(
    @NotEmpty List<Long> ids,
    @NotNull LocalDate dueDate) {
}
