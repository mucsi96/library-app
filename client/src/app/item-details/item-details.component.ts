import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CoverComponent } from '../cover/cover.component';
import { ItemsService } from '../items.service';
import { LibrariesService } from '../libraries.service';
import { LoanItem, LoanStatus } from '../loan-item';
import { dueLabel } from '../utils/due-label';
import {
  LOAN_STATUSES,
  OWN_STATUSES,
  statusLabel,
} from '../utils/status-label';

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
  private readonly librariesService = inject(LibrariesService);
  private readonly initialItem = inject<LoanItem>(MAT_DIALOG_DATA);

  // Chip value for the user's own shelf, which has no library id.
  readonly ownOption = 'MY_OWN';

  // Follows the freshly loaded list after a status change; falls back to
  // the opening item while the list reloads.
  readonly item = computed(
    () =>
      this.itemsService.items
        .value()
        ?.find(({ id }) => id === this.initialItem.id) ?? this.initialItem
  );

  readonly statuses = computed(() =>
    this.item().library === null ? OWN_STATUSES : LOAN_STATUSES
  );

  readonly libraries = computed(
    () => this.librariesService.libraries.value() ?? []
  );

  // The item stores the library name; the picker works with ids.
  readonly selectedLibrary = computed(() => {
    const name = this.item().library;
    return name === null
      ? this.ownOption
      : this.libraries().find((library) => library.name === name)?.id ?? null;
  });

  setStatus(status: LoanStatus | null): void {
    if (status && status !== this.item().status) {
      this.itemsService.setStatus(this.item().id, status);
    }
  }

  setLibrary(value: string | null): void {
    if (value && value !== this.selectedLibrary()) {
      this.itemsService.setLibrary(
        this.item().id,
        value === this.ownOption ? null : value
      );
    }
  }

  statusLabel(status: LoanStatus): string {
    return statusLabel(status, this.item().mediaType);
  }

  dueLabel(): string {
    const dueDate = this.item().dueDate;
    return dueDate === null ? '' : dueLabel(dueDate);
  }
}
