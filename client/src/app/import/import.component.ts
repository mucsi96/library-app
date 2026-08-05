import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ItemsService } from '../items.service';
import { parseLoanTable } from '../utils/parse-loan-table';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly html = signal('');
  readonly importing = signal(false);
  readonly parsedItems = computed(() => parseLoanTable(this.html()));

  onInput(event: Event): void {
    this.html.set((event.target as HTMLTextAreaElement).value);
  }

  async importItems(): Promise<void> {
    this.importing.set(true);
    try {
      const result = await this.itemsService.importItems(this.parsedItems());
      this.snackBar.open(
        `Imported ${result.created} new item(s), updated ${result.updated} existing item(s)`,
        undefined,
        { duration: 5000 }
      );
      this.router.navigateByUrl('/');
    } finally {
      this.importing.set(false);
    }
  }
}
