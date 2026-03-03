import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'bandeja',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bandeja/bandeja.component').then(
        (m) => m.BandejaComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
