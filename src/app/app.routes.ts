import { Routes } from '@angular/router';
import { authnGuard } from './core/guards/authn.guard';

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
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/bandeja/bandeja.component').then(
        (m) => m.BandejaComponent
      ),
  },
  {
    path: 'facturas',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/facturas/facturas.component').then(
        (m) => m.FacturasComponent
      ),
  },
  // Rutas de subnivel de facturas — DEBEN ir antes del wildcard **
  // y antes de la ruta genérica /:id para que 'nueva' no se interprete como id
  {
    path: 'facturas/nueva',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/facturas/nueva-factura-wizard.component').then(
        (m) => m.NuevaFacturaWizardComponent
      ),
  },
  {
    path: 'facturas/:id',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/facturas/factura-detalle.component').then(
        (m) => m.FacturaDetalleComponent
      ),
  },
  {
    path: 'planillas-sap',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/planillas-sap/planillas-sap.component').then(
        (m) => m.PlanillasSapComponent
      ),
  },
  {
    path: 'estadisticas',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/estadisticas/estadisticas.component').then(
        (m) => m.EstadisticasComponent
      ),
  },
  {
    path: 'auditoria',
    canActivate: [authnGuard],
    loadComponent: () =>
      import('./features/auditoria/auditoria.component').then(
        (m) => m.AuditoriaComponent
      ),
  },
  {
    path: 'mantenedores',
    canActivate: [authnGuard],
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
