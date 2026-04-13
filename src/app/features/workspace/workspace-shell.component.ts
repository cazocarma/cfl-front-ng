import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthnService } from '../../core/services/authn.service';
import { AuthzService } from '../../core/services/authz.service';
import { Perms, ROLE_LABELS, Roles } from '../../core/config/permissions';
import type { RoleName } from '../../core/config/permissions';

type WorkspaceSection =
  | 'bandeja'
  | 'carga-entregas'
  | 'facturas'
  | 'planillas'
  | 'mantenedores'
  | 'estadisticas'
  | 'auditoria';

@Component({
    selector: 'app-workspace-shell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, NgClass],
    templateUrl: './workspace-shell.component.html'
})
export class WorkspaceShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() activeSection: WorkspaceSection = 'bandeja';

  sidebarOpen = signal(false);

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

  constructor(private auth: AuthnService, private authz: AuthzService) {}

  get userName(): string {
    const user = this.auth.getCurrentUser();
    return user
      ? user.nombre
        ? `${user.nombre} ${user.apellido ?? ''}`.trim()
        : user.username
      : 'Usuario';
  }

  get roleLabel(): string {
    const role = this.authz.primaryRole() ?? this.auth.getCurrentUser()?.role ?? '';
    return ROLE_LABELS[role as RoleName] ?? role;
  }

  get userInitials(): string {
    return this.userName
      .split(' ')
      .map((word) => word[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  navItemClass(section: WorkspaceSection): string {
    return this.activeSection === section ? 'nav-item nav-item-active' : 'nav-item';
  }

  logout(): void {
    this.auth.logout();
  }
}
