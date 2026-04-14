import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthnService } from '../../services/authn.service';
import { AuthzService } from '../../services/authz.service';
import { Perms, ROLE_LABELS, Roles } from '../../config/permissions';
import type { RoleName } from '../../config/permissions';

/**
 * Sidebar unificado del sistema. Todos los layouts (workspace-shell, bandeja,
 * mantenedores-layout, etc.) deben consumir ESTE componente para asegurar
 * consistencia entre rutas (visibilidad de items, permisos, textos, iconos).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgClass],
  // El host no debe participar en el layout flex: queremos que <aside> actúe
  // como hijo directo del contenedor (para heredar altura y alinear al main).
  styles: [`:host { display: contents; }`],
  template: `
    <!-- Mobile overlay -->
    @if (open) {
      <div
        class="fixed inset-0 z-40 bg-black/50 md:hidden"
        (click)="close.emit()"
        aria-hidden="true"
      ></div>
    }

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col overflow-hidden transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto"
      [ngClass]="open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
      style="background: linear-gradient(180deg, #102614 0%, #1e4424 60%, #25522b 100%);"
    >
      <!-- Logo -->
      <div class="flex items-center gap-2 border-b border-forest-800 px-4 py-4">
        <img src="/logo.png" alt="Greenvic" class="h-10 w-10 flex-shrink-0 rounded-xl object-contain bg-white/10 p-1" />
        <div class="min-w-0 flex-1">
          <div class="text-base font-bold tracking-tight text-white">Greenvic</div>
          <div class="text-[10px] uppercase tracking-wide text-forest-400 leading-none">Control de Fletes</div>
        </div>
        <button type="button" (click)="close.emit()" class="ml-auto flex-shrink-0 rounded-lg p-1.5 text-forest-400 hover:bg-forest-800 hover:text-white transition md:hidden" aria-label="Cerrar menú">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        @if (!authzLoaded()) {
          <!-- Skeleton mientras el contexto no esté confirmado. Evita que items
               aparezcan/desaparezcan por falsos permisos vacíos. -->
          <div class="animate-pulse space-y-2 px-3">
            @for (_ of [1,2,3,4,5]; track _) {
              <div class="h-9 rounded-lg bg-forest-800/40"></div>
            }
          </div>
        } @else {
        <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-forest-600">Menú principal</p>

        <a [routerLink]="['/bandeja']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
          <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
          <span>Bandeja</span>
          @if (bandejaCount !== null && bandejaCount !== undefined) {
            <span class="ml-auto flex items-center justify-center rounded-full bg-forest-500 px-2 py-0.5 text-[10px] font-bold text-white">{{ bandejaCount }}</span>
          }
        </a>

        @if (canSeeFacturas()) {
          <a [routerLink]="['/facturas']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Pre Facturas</span>
          </a>
        }

        @if (canSeePlanillas()) {
          <a [routerLink]="['/planillas-sap']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Planillas SAP</span>
          </a>
        }

        @if (canSeeAdminSection()) {
          <div class="my-3 border-t border-forest-800"></div>
          <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-forest-600">Administración</p>
        }

        @if (canSeeCargaEntregas()) {
          <a [routerLink]="['/carga-entregas']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <span>Carga de Entregas</span>
          </a>
        }

        @if (canSeeEstadisticas()) {
          <a [routerLink]="['/estadisticas']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            <span>Estadísticas</span>
          </a>
        }

        @if (canSeeAuditoria()) {
          <a [routerLink]="['/auditoria']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span>Auditoría</span>
          </a>
        }

        @if (canSeeMantenedores()) {
          <a [routerLink]="['/mantenedores']" routerLinkActive="nav-item-active" class="nav-item" (click)="close.emit()">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>Mantenedores</span>
          </a>
        }
        }
      </nav>

      <div class="border-t border-forest-800 p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-500 text-sm font-bold text-white ring-2 ring-forest-400">{{ userInitials }}</div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">{{ userName }}</p>
            <p class="truncate text-xs text-forest-400">{{ roleLabel }}</p>
          </div>
          <button type="button" (click)="onLogout()" title="Cerrar sesión" class="rounded-lg p-1.5 text-forest-500 transition hover:bg-forest-800 hover:text-red-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class AppSidebarComponent {
  @Input() open = false;
  /** Contador opcional a mostrar como badge junto al link de Bandeja. */
  @Input() bandejaCount: number | null = null;
  @Output() close = new EventEmitter<void>();

  private readonly authz = inject(AuthzService);
  private readonly auth = inject(AuthnService);

  /** Proxy para que el template lea la señal de carga del contexto. */
  readonly authzLoaded = this.authz.loaded;

  readonly canSeeFacturas = computed(() =>
    this.authz.hasAnyPermission(Perms.FACTURAS_VER, Perms.FACTURAS_EDITAR, Perms.FACTURAS_CONCILIAR)
  );
  readonly canSeePlanillas = computed(() =>
    this.authz.hasAnyPermission(Perms.PLANILLAS_VER, Perms.PLANILLAS_GENERAR)
  );
  readonly canSeeCargaEntregas = computed(() =>
    this.authz.hasAnyPermission(Perms.FLETES_SAP_ETL_EJECUTAR, Perms.FLETES_SAP_ETL_VER)
  );
  readonly canSeeEstadisticas = computed(() =>
    this.authz.hasPermission(Perms.REPORTES_VIEW)
  );
  readonly canSeeAuditoria = computed(() =>
    this.authz.primaryRole() === Roles.ADMINISTRADOR
  );
  readonly canSeeMantenedores = computed(() =>
    this.authz.hasAnyPermission(Perms.MANTENEDORES_VIEW, Perms.MANTENEDORES_ADMIN)
  );
  readonly canSeeAdminSection = computed(() =>
    this.canSeeCargaEntregas() || this.canSeeEstadisticas() || this.canSeeAuditoria() || this.canSeeMantenedores()
  );

  constructor() {}

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u
      ? u.nombre ? `${u.nombre} ${u.apellido ?? ''}`.trim() : u.username
      : 'Usuario';
  }

  get roleLabel(): string {
    const role = this.authz.primaryRole() ?? this.auth.getCurrentUser()?.role ?? '';
    return ROLE_LABELS[role as RoleName] ?? role;
  }

  get userInitials(): string {
    return this.userName.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  }

  onLogout(): void {
    this.auth.logout();
  }
}
