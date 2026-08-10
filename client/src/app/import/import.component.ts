import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ImportJobsService } from '../import-jobs.service';
import { ImportQueueComponent } from '../import-queue/import-queue.component';
import { LibrariesService } from '../libraries.service';

type Side = 'front' | 'back';

/** The "My own" chip. Library values are prefixed so no slug can collide. */
const OWN = 'own';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    RouterLink,
    ImportQueueComponent,
  ],
  templateUrl: './import.component.html',
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private readonly importJobs = inject(ImportJobsService);
  private readonly librariesService = inject(LibrariesService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly frontInput =
    viewChild.required<ElementRef<HTMLInputElement>>('frontInput');
  private readonly backInput =
    viewChild.required<ElementRef<HTMLInputElement>>('backInput');

  readonly photos = signal<Record<Side, File | null>>({
    front: null,
    back: null,
  });
  readonly previews = signal<Record<Side, string | null>>({
    front: null,
    back: null,
  });
  readonly queueing = signal(false);
  readonly error = signal<string | null>(null);

  readonly libraries = computed(
    () => this.librariesService.libraries.value() ?? []
  );

  readonly own = OWN;

  // The chip value: 'library:<id>' or 'own'. Kept across imports so a
  // stack of books from the same counter needs one selection.
  readonly destination = signal<string | null>(null);

  readonly uploadProgress = this.importJobs.uploadProgress;

  libraryValue(id: string): string {
    return `library:${id}`;
  }

  onPhotoTaken(side: Side, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      return;
    }
    this.error.set(null);
    this.photos.update((photos) => ({ ...photos, [side]: file }));
    this.previews.update((previews) => {
      const previous = previews[side];
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return { ...previews, [side]: URL.createObjectURL(file) };
    });
  }

  /**
   * Hands the photos to the server and clears the page for the next item.
   * The AI work carries on in the background, so a stack of books can be
   * captured one after another without waiting for any of them.
   */
  async queueImport(): Promise<void> {
    const { front, back } = this.photos();
    const destination = this.destination();
    if (!front || !back || !destination) {
      return;
    }
    const libraryId =
      destination === OWN ? null : destination.replace(/^library:/, '');
    this.queueing.set(true);
    this.error.set(null);
    try {
      await this.importJobs.queueImport(front, back, libraryId);
      this.snackBar.open('Added to the import queue', undefined, {
        duration: 3000,
      });
      this.reset();
    } catch (error) {
      this.error.set(
        (error as { error?: { detail?: string } })?.error?.detail ??
          'Upload failed. Please try again.'
      );
    } finally {
      this.queueing.set(false);
    }
  }

  private reset(): void {
    Object.values(this.previews()).forEach((preview) => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    });

    this.photos.set({ front: null, back: null });
    this.previews.set({ front: null, back: null });

    // Clearing the inputs lets the same file be picked again, which
    // otherwise fires no change event.
    this.frontInput().nativeElement.value = '';
    this.backInput().nativeElement.value = '';
  }
}
