import { Routes } from '@angular/router';
import { authnGuard } from './core/guards/authn.guard';
import { roleGuard } from './core/guards/role.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { Perms, Roles } from './core/config/permissions';

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
    path: 'carga-entregas',
    canActivate: [authnGuard, permissionGuard(Perms.FLETES_SAP_ETL_EJECUTAR, Perms.FLETES_SAP_ETL_VER)],
    loadComponent: () =>
      import('./features/carga-entregas/carga-entregas.component').then(
        (m) => m.CargaEntregasComponent
      ),
  },
  {
    path: 'facturas',
    canActivate: [authnGuard, permissionGuard(Perms.FACTURAS_VER, Perms.FACTURAS_EDITAR, Perms.FACTURAS_CONCILIAR)],
    loadComponent: () =>
      import('./features/facturas/facturas.component').then(
        (m) => m.FacturasComponent
      ),
  },
  // Rutas de subnivel de facturas — DEBEN ir antes del wildcard **
  // y antes de la ruta genérica /:id para que 'nueva' no se interprete como id
  {
    path: 'facturas/nueva',
    canActivate: [authnGuard, permissionGuard(Perms.FACTURAS_EDITAR)],
    loadComponent: () =>
      import('./features/facturas/nueva-factura-wizard.component').then(
        (m) => m.NuevaFacturaWizardComponent
      ),
  },
  {
    path: 'facturas/:id',
    canActivate: [authnGuard, permissionGuard(Perms.FACTURAS_VER, Perms.FACTURAS_EDITAR, Perms.FACTURAS_CONCILIAR)],
    loadComponent: () =>
      import('./features/facturas/factura-detalle.component').then(
        (m) => m.FacturaDetalleComponent
      ),
  },
  {
    path: 'planillas-sap',
    canActivate: [authnGuard, permissionGuard(Perms.PLANILLAS_VER, Perms.PLANILLAS_GENERAR)],
    loadComponent: () =>
      import('./features/planillas-sap/planillas-sap.component').then(
        (m) => m.PlanillasSapComponent
      ),
  },
  {
    path: 'planillas-sap/:id',
    canActivate: [authnGuard, permissionGuard(Perms.PLANILLAS_VER, Perms.PLANILLAS_GENERAR)],
    loadComponent: () =>
      import('./features/planillas-sap/planilla-detalle.component').then(
        (m) => m.PlanillaDetalleComponent
      ),
  },
  {
    path: 'estadisticas',
    canActivate: [authnGuard, permissionGuard(Perms.REPORTES_VIEW)],
    loadComponent: () =>
      import('./features/estadisticas/estadisticas.component').then(
        (m) => m.EstadisticasComponent
      ),
  },
  {
    path: 'auditoria',
    canActivate: [authnGuard, roleGuard(Roles.ADMINISTRADOR)],
    loadComponent: () =>
      import('./features/auditoria/auditoria.component').then(
        (m) => m.AuditoriaComponent
      ),
  },
  {
    path: 'mantenedores',
    canActivate: [authnGuard, permissionGuard(Perms.MANTENEDORES_VIEW, Perms.MANTENEDORES_ADMIN)],
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
