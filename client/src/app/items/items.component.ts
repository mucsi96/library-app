import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { firstValueFrom } from 'rxjs';
import { BulkDueDateComponent } from '../bulk-due-date/bulk-due-date.component';
import { CoverComponent } from '../cover/cover.component';
import { ImportQueueComponent } from '../import-queue/import-queue.component';
import { ItemDetailsComponent } from '../item-details/item-details.component';
import { ItemsService } from '../items.service';
import { LoanItem, LoanStatus, MediaType } from '../loan-item';
import { daysUntilDue, dueLabel } from '../utils/due-label';
import { LOAN_STATUSES, statusLabel } from '../utils/status-label';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatIconModule,
    RouterLink,
    BarLoaderComponent,
    CoverComponent,
    ImportQueueComponent,
  ],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly items = this.itemsService.items;

  // Filter value for the user's own items, which have no library name.
  readonly ownFilter = 'MY_OWN';

  readonly typeFilter = signal<MediaType | null>(null);
  readonly libraryFilter = signal<string | null>(null);
  readonly statusFilter = signal<LoanStatus | null>(null);

  readonly selecting = signal(false);
  readonly selectedIds = signal<readonly number[]>([]);
  readonly saving = signal(false);

  readonly libraries = computed(() =>
    [
      ...new Set(
        (this.items.value() ?? [])
          .map((item) => item.library)
          .filter((library): library is string => library !== null)
      ),
    ].sort()
  );

  readonly hasOwnItems = computed(() =>
    (this.items.value() ?? []).some((item) => item.library === null)
  );

  // One chip per status present in the list; worded for CDs only when no
  // book carries the status, so a chip never mislabels a book.
  readonly statusOptions = computed(() => {
    const items = this.items.value() ?? [];
    return LOAN_STATUSES.filter((status) =>
      items.some((item) => item.status === status)
    ).map((status) => ({
      status,
      label: statusLabel(
        status,
        items
          .filter((item) => item.status === status)
          .every((item) => item.mediaType === 'CD')
          ? 'CD'
          : 'BOOK'
      ),
    }));
  });

  readonly filteredItems = computed(() =>
    (this.items.value() ?? []).filter(
      (item) =>
        (!this.typeFilter() || item.mediaType === this.typeFilter()) &&
        (!this.statusFilter() || item.status === this.statusFilter()) &&
        this.matchesLibrary(item)
    )
  );

  // Only rows the filters currently show can be acted on, so a bulk change
  // never reaches an item that is out of sight.
  readonly selectedItems = computed(() =>
    this.filteredItems().filter((item) => this.selectedIds().includes(item.id))
  );

  readonly allSelected = computed(
    () =>
      this.filteredItems().length > 0 &&
      this.selectedItems().length === this.filteredItems().length
  );

  readonly someSelected = computed(
    () => this.selectedItems().length > 0 && !this.allSelected()
  );

  // Own items have no return deadline, so the due date cannot be set for a
  // selection containing one.
  readonly ownSelected = computed(() =>
    this.selectedItems().some((item) => item.library === null)
  );

  readonly selectionLabel = computed(() => {
    const count = this.selectedItems().length;
    return count === 1 ? '1 item selected' : `${count} items selected`;
  });

  private matchesLibrary(item: LoanItem): boolean {
    const filter = this.libraryFilter();
    if (!filter) {
      return true;
    }
    return filter === this.ownFilter
      ? item.library === null
      : item.library === filter;
  }

  setTypeFilter(value: MediaType | null): void {
    this.typeFilter.set(value);
    this.dropHiddenFromSelection();
  }

  setLibraryFilter(value: string | null): void {
    this.libraryFilter.set(value);
    this.dropHiddenFromSelection();
  }

  setStatusFilter(value: LoanStatus | null): void {
    this.statusFilter.set(value);
    this.dropHiddenFromSelection();
  }

  // A narrowed filter drops the rows it hides out of the selection, so
  // widening it again cannot resurrect items the user stopped looking at.
  private dropHiddenFromSelection(): void {
    const visible = this.filteredItems();
    this.selectedIds.update((ids) =>
      ids.filter((id) => visible.some((item) => item.id === id))
    );
  }

  startSelecting(): void {
    this.selecting.set(true);
  }

  cancelSelection(): void {
    this.selecting.set(false);
    this.selectedIds.set([]);
  }

  isSelected(item: LoanItem): boolean {
    return this.selectedIds().includes(item.id);
  }

  toggle(item: LoanItem): void {
    this.selectedIds.update((ids) =>
      ids.includes(item.id)
        ? ids.filter((id) => id !== item.id)
        : [...ids, item.id]
    );
  }

  toggleAll(): void {
    this.selectedIds.set(
      this.allSelected() ? [] : this.filteredItems().map((item) => item.id)
    );
  }

  selectActionLabel(item: LoanItem): string {
    return `Select "${item.title}"`;
  }

  /**
   * Moves the whole selection to one new due date - the stack handed back
   * over the counter and renewed together.
   */
  async changeDueDate(): Promise<void> {
    const items = this.selectedItems();
    if (!items.length || this.ownSelected()) {
      return;
    }

    const dialogRef = this.dialog.open<
      BulkDueDateComponent,
      LoanItem[],
      string
    >(BulkDueDateComponent, {
      data: items,
      width: '420px',
      maxWidth: 'calc(100vw - 2rem)',
    });

    const dueDate = await firstValueFrom(dialogRef.afterClosed());
    if (!dueDate) {
      return;
    }

    this.saving.set(true);
    try {
      await this.itemsService.setDueDate(
        items.map((item) => item.id),
        dueDate
      );
      this.snackBar.open(
        items.length === 1
          ? 'Due date updated for 1 item'
          : `Due date updated for ${items.length} items`,
        undefined,
        { duration: 3000 }
      );
      this.cancelSelection();
    } catch {
      // The error interceptor already reports it; the selection stays so
      // the change can be tried again.
    } finally {
      this.saving.set(false);
    }
  }

  openDetails(item: LoanItem): void {
    this.dialog.open(ItemDetailsComponent, {
      data: item,
      width: '420px',
      maxWidth: 'calc(100vw - 2rem)',
    });
  }

  statusLabel(item: LoanItem): string {
    return statusLabel(item.status, item.mediaType);
  }

  statusActionLabel(item: LoanItem): string {
    return `Change status of "${item.title}"`;
  }

  // Distinct accessible names keep the title and status buttons of the
  // same item unambiguous for assistive tech and role-based selectors.
  detailsActionLabel(item: LoanItem): string {
    return `Show details of "${item.title}"`;
  }

  isOverdue(item: LoanItem): boolean {
    return item.dueDate !== null && daysUntilDue(item.dueDate) < 0;
  }

  isDueSoon(item: LoanItem): boolean {
    if (item.dueDate === null) {
      return false;
    }
    const days = daysUntilDue(item.dueDate);
    return days >= 0 && days <= 7;
  }

  dueLabel(item: LoanItem): string {
    return item.dueDate === null ? '' : dueLabel(item.dueDate);
  }
}
