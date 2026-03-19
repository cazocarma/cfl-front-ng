import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthnService } from '../../core/services/authn.service';

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
    imports: [CommonModule, RouterLink],
    templateUrl: './workspace-shell.component.html'
})
export class WorkspaceShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() activeSection: WorkspaceSection = 'bandeja';

  sidebarOpen = signal(false);

  constructor(private auth: AuthnService) {}

  get userName(): string {
    const user = this.auth.getCurrentUser();
    return user
      ? user.nombre
        ? `${user.nombre} ${user.apellido ?? ''}`.trim()
        : user.username
      : 'Usuario';
  }

  get userRole(): string {
    return this.auth.getCurrentUser()?.role ?? '';
  }

  get roleLabel(): string {
    const labels: Record<string, string> = {
      ingresador: 'Ingresador',
      autorizador: 'Autorizador',
      administrador: 'Administrador',
    };
    return labels[this.userRole] ?? this.userRole;
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
