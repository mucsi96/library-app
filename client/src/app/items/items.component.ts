import { Component, computed, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CoverComponent } from '../cover/cover.component';
import { ImportQueueComponent } from '../import-queue/import-queue.component';
import { ItemDetailsComponent } from '../item-details/item-details.component';
import { ItemsService } from '../items.service';
import { LoanItem, MediaType } from '../loan-item';
import { daysUntilDue, dueLabel } from '../utils/due-label';
import { statusLabel } from '../utils/status-label';

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

  readonly typeFilter = signal<MediaType | null>(null);
  readonly libraryFilter = signal<string | null>(null);

  readonly libraries = computed(() =>
    [
      ...new Set(
        (this.items.value() ?? [])
          .map((item) => item.library)
          .filter((library): library is string => library !== null)
      ),
    ].sort()
  );

  readonly filteredItems = computed(() =>
    (this.items.value() ?? []).filter(
      (item) =>
        (!this.typeFilter() || item.mediaType === this.typeFilter()) &&
        (!this.libraryFilter() || item.library === this.libraryFilter())
    )
  );

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

  isDone(item: LoanItem): boolean {
    return item.status !== 'LOANED' && item.status !== 'READING';
  }

  isRead(item: LoanItem): boolean {
    return item.status === 'READ' || item.status === 'READ_RETURNED';
  }

  isOverdue(item: LoanItem): boolean {
    return daysUntilDue(item.dueDate) < 0;
  }

  isDueSoon(item: LoanItem): boolean {
    const days = daysUntilDue(item.dueDate);
    return days >= 0 && days <= 7;
  }

  dueLabel(item: LoanItem): string {
    return dueLabel(item.dueDate);
  }
}
