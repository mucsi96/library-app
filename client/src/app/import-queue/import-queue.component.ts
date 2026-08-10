import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CoverComponent, CoverSubject } from '../cover/cover.component';
import { ImportJob } from '../import-job';
import { ImportJobsService } from '../import-jobs.service';

const PROGRESS_LABELS: Record<string, string> = {
  QUEUED: 'Waiting in queue',
  EXTRACTING: 'Reading the ISBN…',
  GENERATING_COVER: 'Drawing the cover…',
  COMPLETED: 'Added to your loans',
};

/**
 * The imports currently being worked on. Each card starts as the photo the
 * user took and fills in as the AI gets further, so a queued item is
 * recognisable long before it has a title or a cover.
 */
@Component({
  selector: 'app-import-queue',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, BarLoaderComponent, CoverComponent],
  templateUrl: './import-queue.component.html',
  styleUrl: './import-queue.component.css',
})
export class ImportQueueComponent {
  private readonly importJobs = inject(ImportJobsService);

  readonly jobs = computed(() => this.importJobs.jobs.value() ?? []);

  progressLabel(job: ImportJob): string {
    return PROGRESS_LABELS[job.status] ?? '';
  }

  headline(job: ImportJob): string {
    return job.title ?? 'New item';
  }

  /** Completed imports show their real cover; the rest show the photo. */
  photoUrl(job: ImportJob): string | null {
    return job.status === 'COMPLETED' ? null : this.importJobs.photoUrl(job);
  }

  coverSubject(job: ImportJob): CoverSubject {
    return {
      isbn: job.isbn,
      title: this.headline(job),
      mediaType: job.mediaType ?? 'BOOK',
    };
  }

  retryLabel(job: ImportJob): string {
    return `Retry importing ${this.headline(job)}`;
  }

  dismissLabel(job: ImportJob): string {
    return `Dismiss import of ${this.headline(job)}`;
  }

  retry(job: ImportJob): void {
    this.importJobs.retry(job);
  }

  dismiss(job: ImportJob): void {
    this.importJobs.dismiss(job);
  }

  readonly savingIsbn = signal<string | null>(null);
  private readonly isbnErrors = signal<Record<string, string>>({});

  isbnError(job: ImportJob): string | null {
    return this.isbnErrors()[job.reference] ?? null;
  }

  /** Sends the typed ISBN; validation errors stay on this job's card. */
  async submitIsbn(
    job: ImportJob,
    input: HTMLInputElement,
    event: Event
  ): Promise<void> {
    event.preventDefault();

    this.savingIsbn.set(job.reference);
    this.isbnErrors.update(
      ({ [job.reference]: _, ...others }) => others
    );
    try {
      await this.importJobs.submitIsbn(job, input.value);
    } catch (error) {
      this.isbnErrors.update((errors) => ({
        ...errors,
        [job.reference]:
          (error as { error?: { detail?: string } })?.error?.detail ??
          'Could not save the ISBN. Please try again.',
      }));
    } finally {
      this.savingIsbn.set(null);
    }
  }
}
