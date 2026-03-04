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
    path: 'facturas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/facturas/facturas.component').then(
        (m) => m.FacturasComponent
      ),
  },
  {
    path: 'planillas-sap',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/planillas-sap/planillas-sap.component').then(
        (m) => m.PlanillasSapComponent
      ),
  },
  {
    path: 'estadisticas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/estadisticas/estadisticas.component').then(
        (m) => m.EstadisticasComponent
      ),
  },
  {
    path: 'auditoria',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auditoria/auditoria.component').then(
        (m) => m.AuditoriaComponent
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
