import { Component, computed, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
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
    MatChipsModule,
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
  readonly items = this.itemsService.items;

  // Filter value for the user's own items, which have no library name.
  readonly ownFilter = 'MY_OWN';

  readonly typeFilter = signal<MediaType | null>(null);
  readonly libraryFilter = signal<string | null>(null);
  readonly statusFilter = signal<LoanStatus | null>(null);

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

  private matchesLibrary(item: LoanItem): boolean {
    const filter = this.libraryFilter();
    if (!filter) {
      return true;
    }
    return filter === this.ownFilter
      ? item.library === null
      : item.library === filter;
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
