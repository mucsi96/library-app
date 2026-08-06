import { Component, computed, inject, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CoverComponent } from '../cover/cover.component';
import { ItemsService } from '../items.service';
import { LoanItem, MediaType } from '../loan-item';
import { daysUntilDue, dueLabel } from '../utils/due-label';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatChipsModule,
    RouterLink,
    BarLoaderComponent,
    CoverComponent,
  ],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent {
  private readonly itemsService = inject(ItemsService);
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

  setCompleted(item: LoanItem, completed: boolean): void {
    this.itemsService.setCompleted(item.id, completed);
  }

  completedLabel(item: LoanItem): string {
    return `Mark "${item.title}" as ${item.mediaType === 'CD' ? 'listened' : 'read'}`;
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
