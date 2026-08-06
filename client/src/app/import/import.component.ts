import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ItemsService } from '../items.service';

type Side = 'front' | 'back';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, BarLoaderComponent],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly photos = signal<Record<Side, File | null>>({
    front: null,
    back: null,
  });
  readonly previews = signal<Record<Side, string | null>>({
    front: null,
    back: null,
  });
  readonly importing = signal(false);
  readonly error = signal<string | null>(null);

  onPhotoTaken(side: Side, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      return;
    }
    this.error.set(null);
    this.photos.update((photos) => ({ ...photos, [side]: file }));
    this.previews.update((previews) => ({
      ...previews,
      [side]: URL.createObjectURL(file),
    }));
  }

  async importItem(): Promise<void> {
    const { front, back } = this.photos();
    if (!front || !back) {
      return;
    }
    this.importing.set(true);
    this.error.set(null);
    try {
      const item = await this.itemsService.importItem(front, back);
      this.snackBar.open(`Imported "${item.title}"`, undefined, {
        duration: 5000,
      });
      this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(
        (error as { error?: { detail?: string } })?.error?.detail ??
          'Import failed. Please try again.'
      );
    } finally {
      this.importing.set(false);
    }
  }
}
