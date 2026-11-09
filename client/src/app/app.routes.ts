import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./items/items.component').then((m) => m.ItemsComponent),
    title: 'My loans',
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./import/import.component').then((m) => m.ImportComponent),
    title: 'Import item',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings',
  },
];
