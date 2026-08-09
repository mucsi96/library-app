import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CoverComponent } from '../cover/cover.component';
import { ItemsService } from '../items.service';
import { LoanItem, LoanStatus } from '../loan-item';
import { dueLabel } from '../utils/due-label';
import { LOAN_STATUSES, statusLabel } from '../utils/status-label';

@Component({
  selector: 'app-item-details',
  standalone: true,
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    CoverComponent,
  ],
  templateUrl: './item-details.component.html',
  styleUrl: './item-details.component.css',
})
export class ItemDetailsComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly initialItem = inject<LoanItem>(MAT_DIALOG_DATA);

  readonly statuses = LOAN_STATUSES;

  // Follows the freshly loaded list after a status change; falls back to
  // the opening item while the list reloads.
  readonly item = computed(
    () =>
      this.itemsService.items
        .value()
        ?.find(({ id }) => id === this.initialItem.id) ?? this.initialItem
  );

  setStatus(status: LoanStatus | null): void {
    if (status && status !== this.item().status) {
      this.itemsService.setStatus(this.item().id, status);
    }
  }

  statusLabel(status: LoanStatus): string {
    return statusLabel(status, this.item().mediaType);
  }

  dueLabel(): string {
    return dueLabel(this.item().dueDate);
  }
}
