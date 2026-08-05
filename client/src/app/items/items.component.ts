import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ItemsService } from '../items.service';
import { LoanItem } from '../loan-item';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [DatePipe, MatCheckboxModule, RouterLink, BarLoaderComponent],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent {
  private readonly itemsService = inject(ItemsService);
  readonly items = this.itemsService.items;

  setCompleted(item: LoanItem, completed: boolean): void {
    this.itemsService.setCompleted(item.id, completed);
  }

  completedLabel(item: LoanItem): string {
    return `Mark "${item.title}" as ${item.mediaType === 'CD' ? 'listened' : 'read'}`;
  }

  isOverdue(item: LoanItem): boolean {
    return this.daysUntilDue(item) < 0;
  }

  dueLabel(item: LoanItem): string | null {
    const days = this.daysUntilDue(item);

    if (days < 0) {
      return 'Overdue';
    }
    if (days === 0) {
      return 'Due today';
    }
    if (days === 1) {
      return 'Due tomorrow';
    }
    if (days <= 7) {
      return `Due in ${days} days`;
    }
    return null;
  }

  private daysUntilDue(item: LoanItem): number {
    const today = new Date().setHours(0, 0, 0, 0);
    const due = new Date(`${item.dueDate}T00:00:00`).getTime();
    return Math.round((due - today) / DAY_MS);
  }
}
