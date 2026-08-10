import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { AuthService } from './auth.service';
import { ImportJobsService } from './import-jobs.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    HeaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly importJobs = inject(ImportJobsService);

  isAuthenticated = this.authService.isAuthenticated;
  authError = this.authService.authError;

  /** Keeps in-flight imports visible from any route. */
  readonly importsInFlight = computed(() => this.importJobs.active().length);

  retryLogin(): void {
    this.authService.login();
  }
}
