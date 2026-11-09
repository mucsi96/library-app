import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library';

/**
 * Manages the predefined list of libraries the import page picks from,
 * so an import never depends on the AI guessing where an item came from.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly librariesService = inject(LibrariesService);

  readonly libraries = computed(
    () => this.librariesService.libraries.value() ?? []
  );
  readonly name = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  async add(event: Event): Promise<void> {
    event.preventDefault();

    const name = this.name().trim();
    if (!name) {
      return;
    }

    this.saving.set(true);
    try {
      await this.librariesService.add(name);
      this.name.set('');
    } catch (error) {
      this.error.set(
        (error as { error?: { detail?: string } })?.error?.detail ??
          'Could not add the library. Please try again.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  removeLabel(library: Library): string {
    return `Remove ${library.name}`;
  }

  async remove(library: Library): Promise<void> {
    await this.librariesService.remove(library);
  }
}
