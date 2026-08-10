import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./items/items.component').then((m) => m.ItemsComponent),
    canActivate: [authGuard],
    title: 'My loans',
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./import/import.component').then((m) => m.ImportComponent),
    canActivate: [authGuard],
    title: 'Import item',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings',
  },
];
