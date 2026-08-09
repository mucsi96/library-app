import { HttpClient } from '@angular/common/http';
import { Component, inject, input, resource } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LoanItem } from '../loan-item';
import { fetchAsset } from '../utils/fetchAsset';

@Component({
  selector: 'app-cover',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cover.component.html',
  styleUrl: './cover.component.css',
})
export class CoverComponent {
  private readonly http = inject(HttpClient);

  readonly item = input.required<LoanItem>();

  readonly size = input<'small' | 'large'>('small');

  readonly thumbnail = resource({
    params: () => ({ isbn: this.item().isbn }),
    loader: async ({ params }) =>
      params.isbn ? fetchAsset(this.http, `/api/thumbnails/${params.isbn}`) : null,
  });

  coverLabel(): string {
    return `Cover of "${this.item().title}"`;
  }
}
