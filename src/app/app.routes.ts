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
    path: 'mantenedores',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/mantenedores/mantenedores-layout.component').then(
        (m) => m.MantenedoresLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/mantenedores/mantenedores-home.component').then(
            (m) => m.MantenedoresHomeComponent
          ),
      },
      {
        path: ':entity',
        loadComponent: () =>
          import('./features/mantenedores/mantenedor-tabla/mantenedor-tabla.component').then(
            (m) => m.MantenedorTablaComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
