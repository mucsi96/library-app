import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { LoanItem } from '../loan-item';
import { dueLabel } from '../utils/due-label';

/**
 * Picks one new due date for the items selected in the loans list. A
 * native date input is used on purpose, so a phone opens its own date
 * wheel instead of a cramped in-page calendar.
 */
@Component({
  selector: 'app-bulk-due-date',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './bulk-due-date.component.html',
  styleUrl: './bulk-due-date.component.css',
})
export class BulkDueDateComponent {
  private readonly dialogRef =
    inject<MatDialogRef<BulkDueDateComponent, string>>(MatDialogRef);
  readonly items = inject<LoanItem[]>(MAT_DIALOG_DATA);

  // The most urgent deadline of the selection is the one being extended,
  // so it is the natural starting point of the picker.
  readonly dueDate = signal(
    this.items
      .map((item) => item.dueDate)
      .filter((date): date is string => date !== null)
      .sort()[0] ?? ''
  );

  readonly heading = computed(() =>
    this.items.length === 1
      ? 'Set due date for 1 item'
      : `Set due date for ${this.items.length} items`
  );

  readonly preview = computed(() =>
    this.dueDate() ? dueLabel(this.dueDate()) : ''
  );

  onDateInput(event: Event): void {
    this.dueDate.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (this.dueDate()) {
      this.dialogRef.close(this.dueDate());
    }
  }
}
