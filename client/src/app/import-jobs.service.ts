import {
  HttpClient,
  HttpContext,
  HttpEventType,
  HttpResponse,
} from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { filter, firstValueFrom, map, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { ImportJob, isSettled } from './import-job';
import { ItemsService } from './items.service';
import { SKIP_ERROR_NOTIFICATION } from './utils/error.interceptor';
import { fetchJson } from './utils/fetchJson';

const POLL_INTERVAL_MS = 1500;

@Injectable({
  providedIn: 'root',
})
export class ImportJobsService {
  private readonly http = inject(HttpClient);
  private readonly itemsService = inject(ItemsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // The queue is shown from the app shell, which lives outside the auth
  // guard, so the poll waits for a session and never notifies on failure -
  // a dropped background poll is not something to interrupt the user with.
  readonly jobs = resource<ImportJob[], { authenticated: boolean }>({
    params: () => ({ authenticated: this.auth.isAuthenticated() }),
    loader: ({ params }) =>
      params.authenticated
        ? fetchJson<ImportJob[]>(this.http, '/api/import-jobs', {
            context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
          })
        : Promise.resolve([]),
  });

  /** Percentage of the photo upload in flight, null when idle. */
  readonly uploadProgress = signal<number | null>(null);

  readonly active = computed(() =>
    (this.jobs.value() ?? []).filter((job) => !isSettled(job))
  );

  /**
   * Jobs worth polling for. A failed job waits for the user, so it never
   * keeps the timer alive; a completed one still disappears on its own
   * once the server stops listing it.
   */
  private readonly unsettled = computed(() =>
    (this.jobs.value() ?? []).filter((job) => job.status !== 'FAILED')
  );

  private readonly foregrounded = signal(!document.hidden);
  private readonly completedSeen = new Set<string>();

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const onVisibilityChange = () => {
      this.foregrounded.set(!document.hidden);

      if (!document.hidden) {
        this.jobs.reload();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.stopPolling();
    });

    // Poll only while something can still change, and never behind a
    // hidden tab - a phone in a pocket should not be talking to the API.
    effect(() => {
      if (this.unsettled().length > 0 && this.foregrounded()) {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    });

    // A finished import means the loans list has a new row in it.
    effect(() => {
      const freshlyCompleted = (this.jobs.value() ?? []).filter(
        (job) =>
          job.status === 'COMPLETED' && !this.completedSeen.has(job.reference)
      );

      if (freshlyCompleted.length === 0) {
        return;
      }

      freshlyCompleted.forEach((job) => this.completedSeen.add(job.reference));
      this.itemsService.items.reload();
    });
  }

  photoUrl(job: ImportJob): string {
    return `/api/import-jobs/${job.reference}/photo`;
  }

  /**
   * Uploads both photos and queues the import. Resolves as soon as the
   * server has staged them, so the camera is free again immediately.
   */
  async queueImport(front: File, back: File): Promise<ImportJob> {
    const photos = new FormData();
    photos.append('front', front);
    photos.append('back', back);

    this.uploadProgress.set(0);

    try {
      const job = await firstValueFrom(
        this.http
          .post<ImportJob>('/api/items/import', photos, {
            // Upload failures surface inline on the import page instead of
            // as a global notification.
            context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
            reportProgress: true,
            observe: 'events',
          })
          .pipe(
            tap((event) => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                this.uploadProgress.set(
                  Math.round((event.loaded / event.total) * 100)
                );
              }
            }),
            filter(
              (event): event is HttpResponse<ImportJob> =>
                event.type === HttpEventType.Response
            ),
            map((response) => response.body as ImportJob)
          )
      );

      this.jobs.reload();

      return job;
    } finally {
      this.uploadProgress.set(null);
    }
  }

  async retry(job: ImportJob): Promise<void> {
    await fetchJson<ImportJob>(
      this.http,
      `/api/import-jobs/${job.reference}/retry`,
      { method: 'post' }
    );
    this.jobs.reload();
  }

  async dismiss(job: ImportJob): Promise<void> {
    await fetchJson<void>(this.http, `/api/import-jobs/${job.reference}`, {
      method: 'delete',
    });
    this.jobs.reload();
  }

  private startPolling(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = setInterval(() => this.jobs.reload(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
