# cfl-front-ng

Frontend Angular 21 del sistema Control de Fletes (CFL) de Greenvic.

## Stack

- Angular 21 (standalone components, signals, OnPush)
- Tailwind CSS 4 (tema forest personalizado)
- RxJS para operaciones async
- Sin NgModules

## Levantar

```bash
# Local
npm install
ng serve

# Docker (desde cfl-infra)
cd ../cfl-infra
docker compose up front-ng
```

Frontend disponible en `http://localhost:3000`.

## Arquitectura

```
src/app/
  core/
    config/         api-base.ts, permissions.ts (constantes Perms/Roles)
    directives/     disabled-if-no-permission.directive.ts
    guards/         authn.guard.ts, role.guard.ts, permission.guard.ts
    interceptors/   authn.interceptor.ts, network-error.interceptor.ts
    models/         flete.model.ts, control-flete-carga-job.model.ts
    services/       authn.service.ts, authz.service.ts, cfl-api.service.ts, toast.service.ts
    utils/          format.utils.ts
  features/
    login/          Pagina de login (Keycloak-ready)
    bandeja/        Bandeja de fletes (candidatos SAP/Romana + en curso)
    facturas/       Pre facturas (listado, detalle, wizard nueva factura)
    planillas-sap/  Planillas SAP (listado, detalle, generacion)
    carga-entregas/ Carga de entregas SAP y Romana
    estadisticas/   Dashboard de estadisticas y KPIs
    auditoria/      Log de auditoria (solo Administrador)
    mantenedores/   CRUD generico de entidades maestras
    workspace/      Shell con sidebar (compartido entre vistas)
```

## Autorizacion

### Servicios

- **`AuthnService`**: Maneja JWT (localStorage), login/logout, decode de claims.
- **`AuthzService`**: Consume `GET /api/authn/context` para obtener roles y permisos del servidor. Expone signals reactivos (`permissions`, `roles`, `primaryRole`, `loaded`).

### Guards

| Guard | Uso |
|---|---|
| `authnGuard` | Verifica JWT valido en localStorage |
| `permissionGuard(...perms)` | Espera `AuthzService.ensureLoaded()`, luego verifica permisos (OR) |
| `roleGuard(...roles)` | Verifica rol del JWT (usado solo para Auditoria) |

### Directiva

`[disabledIfNoPermission]="'permiso'"` — deshabilita el elemento con tooltip si el usuario no tiene el permiso. Usa input signals para reactividad completa con OnPush.

### Constantes

`core/config/permissions.ts` centraliza todos los strings de permisos y roles:
```typescript
import { Perms, Roles, ROLE_LABELS } from './core/config/permissions';
// Perms.FLETES_CREAR, Roles.ADMINISTRADOR, etc.
```

## Rutas

| Ruta | Guard | Descripcion |
|---|---|---|
| `/login` | Ninguno | Login |
| `/bandeja` | `authnGuard` | Bandeja de fletes |
| `/facturas` | `permissionGuard(facturas.ver, ...)` | Pre facturas |
| `/facturas/nueva` | `permissionGuard(facturas.editar)` | Wizard nueva factura |
| `/facturas/:id` | `permissionGuard(facturas.ver, ...)` | Detalle factura |
| `/planillas-sap` | `permissionGuard(planillas.ver, ...)` | Planillas SAP |
| `/planillas-sap/:id` | `permissionGuard(planillas.ver, ...)` | Detalle planilla |
| `/carga-entregas` | `permissionGuard(fletes.sap.etl.*)` | Carga de entregas |
| `/estadisticas` | `permissionGuard(reportes.view)` | Estadisticas |
| `/auditoria` | `roleGuard(administrador)` | Auditoria |
| `/mantenedores` | `permissionGuard(mantenedores.view, ...)` | Mantenedores |

## Sidebar

El sidebar se renderiza condicionalmente segun permisos del usuario. Usa computed signals que reaccionan a cambios en `AuthzService.permissions()`. Los links de Auditoria y Mantenedores solo aparecen para roles con acceso.
