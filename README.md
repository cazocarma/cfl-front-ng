# CFL Frontend

Interfaz web del sistema Control de Fletes (CFL) de Greenvic. Aplicacion Angular de pagina unica (SPA) que permite gestionar el ciclo completo de fletes: ingesta desde SAP y romana, revision y edicion, prefacturacion, generacion de planillas SAP, estadisticas operativas y administracion de datos maestros.

## Stack tecnologico

| Componente | Tecnologia |
| --- | --- |
| Framework | Angular 21 (standalone components, signals, OnPush) |
| Estilos | Tailwind CSS 3.4 con paleta personalizada |
| Graficos | Chart.js 4.5 + ng2-charts 10 |
| Reactividad | RxJS 7.8, Angular Signals |
| Lenguaje | TypeScript 5.9 |
| Servidor produccion | Nginx 1.27 (Alpine) |

## Requisitos previos

- Node.js 20 o superior
- Angular CLI (`npm install -g @angular/cli`)
- Backend CFL ejecutandose en `http://localhost:4000` (o la URL configurada)

## Instalacion y ejecucion

### Desarrollo local

```bash
npm install
npm start
```

La aplicacion queda disponible en `http://localhost:3000`. El servidor de desarrollo escucha en todas las interfaces (`0.0.0.0`) para permitir acceso desde otros dispositivos en la red local.

### Docker Compose (desde cfl-infra)

```bash
cd ../cfl-infra
make up
```

## Estructura del proyecto

```text
src/app/
  app.component.ts              Componente raiz
  app.config.ts                 Configuracion de providers (HTTP, routing, animaciones)
  app.routes.ts                 Definicion de rutas con lazy loading y guards
  core/
    components/
      app-sidebar/              Sidebar de navegacion con visibilidad por permisos
    config/
      api-base.ts               URL base de la API
      permissions.ts            Constantes centralizadas de permisos (Perms) y roles (Roles)
    constants/                  Constantes de negocio
    directives/
      disabled-if-no-permission.directive.ts   Deshabilita elementos sin permiso
    guards/
      authn.guard.ts            Verifica existencia de JWT valido
      role.guard.ts             Verifica rol del usuario
      permission.guard.ts       Verifica permisos especificos (logica OR)
    interceptors/
      authn.interceptor.ts      Inyecta token JWT en headers de requests
      network-error.interceptor.ts  Manejo centralizado de errores HTTP
    models/
      flete.model.ts            Interfaces de dominio para fletes
      control-flete-carga-job.model.ts  Interfaces para jobs de carga
    services/
      authn.service.ts          Gestion de JWT, login/logout, decode de claims
      authz.service.ts          Obtencion de roles/permisos desde el servidor (signals reactivos)
      cfl-api.service.ts        Cliente HTTP centralizado para la API REST
      toast.service.ts          Notificaciones al usuario
    utils/
      format.utils.ts           Utilidades de formateo de datos
  features/
    login/                      Pagina de inicio de sesion
    bandeja/                    Bandeja principal de fletes (candidatos SAP/Romana + en curso)
      edit-flete-modal/         Modal de edicion rapida de flete
    facturas/                   Gestion de prefacturas (listado, detalle, wizard de creacion)
    planillas-sap/              Planillas SAP (listado, detalle, generacion)
    carga-entregas/             Carga de entregas desde SAP y romana
    estadisticas/               Dashboard de estadisticas y KPIs con graficos
    auditoria/                  Log de auditoria (solo Administrador)
    mantenedores/               CRUD generico de entidades maestras
      rutas/                    Gestion de rutas logisticas
      tarifas/                  Gestion de tarifas
      usuarios/                 Gestion de usuarios y asignacion de roles
      mantenedor-form/          Formulario generico reutilizable
    workspace/                  Shell con sidebar compartido entre vistas
  shared/
    confirm-modal.component.ts  Modal de confirmacion reutilizable
```

## Rutas y control de acceso

Todas las rutas excepto `/login` requieren autenticacion. Las rutas protegidas utilizan guards que verifican permisos antes de permitir la navegacion.

| Ruta | Guard | Descripcion |
| --- | --- | --- |
| `/login` | Ninguno | Inicio de sesion |
| `/bandeja` | `authnGuard` | Bandeja de fletes con candidatos y fletes en curso |
| `/facturas` | `permissionGuard(facturas.ver, ...)` | Listado de prefacturas |
| `/facturas/nueva` | `permissionGuard(facturas.editar)` | Wizard de creacion de prefactura en 3 pasos |
| `/facturas/:id` | `permissionGuard(facturas.ver, ...)` | Detalle y edicion de factura |
| `/planillas-sap` | `permissionGuard(planillas.ver, ...)` | Listado de planillas SAP |
| `/planillas-sap/:id` | `permissionGuard(planillas.ver, ...)` | Detalle de planilla SAP |
| `/carga-entregas` | `permissionGuard(fletes.sap.etl.*)` | Carga de entregas SAP y romana |
| `/estadisticas` | `permissionGuard(reportes.view)` | Dashboard de estadisticas |
| `/auditoria` | `roleGuard(administrador)` | Log de auditoria (solo Administrador) |
| `/mantenedores` | `permissionGuard(mantenedores.view, ...)` | CRUD de datos maestros |

## Autorizacion

### Servicios

- **AuthnService**: Gestiona el ciclo de vida del JWT (almacenamiento en localStorage, login, logout, decodificacion de claims). Expone el estado de autenticacion como observable.
- **AuthzService**: Consume `GET /api/authn/context` para obtener roles y permisos del servidor. Expone signals reactivos (`permissions`, `roles`, `primaryRole`, `loaded`) que permiten reactividad completa con la estrategia OnPush de deteccion de cambios.

### Guards

| Guard | Comportamiento |
| --- | --- |
| `authnGuard` | Verifica que exista un JWT valido en localStorage. Redirige a `/login` en caso contrario |
| `permissionGuard(...perms)` | Espera a que `AuthzService` cargue los permisos, luego verifica que el usuario tenga al menos uno de los permisos indicados (logica OR) |
| `roleGuard(...roles)` | Verifica el rol del usuario directamente desde el JWT |

### Directiva de permisos

La directiva `[disabledIfNoPermission]` deshabilita elementos del DOM y muestra un tooltip explicativo cuando el usuario no cuenta con el permiso requerido. Utiliza input signals para reactividad completa con la estrategia OnPush.

```html
<button [disabledIfNoPermission]="'facturas.editar'">Crear factura</button>
```

### Constantes centralizadas

El archivo `core/config/permissions.ts` centraliza todos los identificadores de permisos y roles para evitar strings dispersos en el codigo:

```typescript
import { Perms, Roles, ROLE_LABELS } from './core/config/permissions';
// Perms.FLETES_CREAR, Roles.ADMINISTRADOR, ROLE_LABELS[rol], etc.
```

## Sidebar

El sidebar de navegacion se renderiza condicionalmente segun los permisos del usuario autenticado. Utiliza computed signals que reaccionan automaticamente a cambios en `AuthzService.permissions()`. Los enlaces de Auditoria y Mantenedores solo aparecen para roles con acceso a esas secciones.

En dispositivos moviles, el sidebar es colapsable con un overlay oscuro y transicion animada.

## Tema visual

La aplicacion utiliza una paleta de colores personalizada basada en tonos naturales, definida en `tailwind.config.js`:

| Paleta | Uso |
| --- | --- |
| `forest` | Color primario (verde, 50-950) |
| `sage` | Acentos secundarios (verde-gris) |
| `earth` | Acentos calidos (marron/naranja) |

Tipografia principal: Inter (fallback a system-ui). Animaciones personalizadas: `fade-in`, `slide-down`, `pulse-slow`. Sombras con tinte verde: `nature`, `nature-lg`.

## Docker

La imagen de produccion utiliza un build multi-etapa:

1. **Etapa de build**: `node:20-alpine`. Instala dependencias y ejecuta `npm run build` para generar los assets estaticos.
2. **Etapa de runtime**: `nginx:1.27-alpine`. Sirve los assets con compresion gzip, headers de seguridad (CSP, X-Frame-Options, X-Content-Type-Options), cache de un anio para archivos estaticos y ruteo SPA (fallback a `index.html`).

La imagen resultante se ejecuta como usuario no-root (`nginx`), expone el puerto 3000 e incluye un health check en `/healthz`.

## Verificacion

```bash
curl http://localhost:3000/healthz
```

Una respuesta `200 OK` confirma que el servidor Nginx esta activo y sirviendo la aplicacion.
