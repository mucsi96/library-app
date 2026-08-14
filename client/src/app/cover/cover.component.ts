import { HttpClient } from '@angular/common/http';
import { Component, inject, input, resource } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LoanItem, MediaType } from '../loan-item';
import { fetchAsset } from '../utils/fetchAsset';

const PLACEHOLDER_ICONS: Record<MediaType, string> = {
  BOOK: 'menu_book',
  CD: 'album',
  DVD: 'movie',
};

/** The little a cover needs to know about what it is showing. */
export type CoverSubject = Pick<LoanItem, 'isbn' | 'title' | 'mediaType'>;

@Component({
  selector: 'app-cover',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cover.component.html',
  styleUrl: './cover.component.css',
})
export class CoverComponent {
  private readonly http = inject(HttpClient);

  readonly item = input.required<CoverSubject>();

  readonly size = input<'small' | 'large'>('small');

  /**
   * Overrides the generated thumbnail, so an import still being processed
   * can stand in with the photo the user just took.
   */
  readonly assetUrl = input<string | null>(null);

  readonly image = resource({
    params: () => ({ url: this.imageUrl() }),
    loader: async ({ params }) =>
      params.url ? fetchAsset(this.http, params.url) : null,
  });

  coverLabel(): string {
    return `Cover of "${this.item().title}"`;
  }

  placeholderIcon(): string {
    return PLACEHOLDER_ICONS[this.item().mediaType];
  }

  private imageUrl(): string | null {
    const override = this.assetUrl();

    if (override) {
      return override;
    }

    const isbn = this.item().isbn;

    return isbn ? `/api/thumbnails/${isbn}` : null;
  }
}
