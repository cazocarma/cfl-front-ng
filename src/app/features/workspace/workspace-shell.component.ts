import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

import { AppSidebarComponent } from '../../core/components/app-sidebar/app-sidebar.component';

@Component({
    selector: 'app-workspace-shell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [AppSidebarComponent],
    templateUrl: './workspace-shell.component.html'
})
export class WorkspaceShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  /** @deprecated ya no se usa. El item activo se resuelve vía routerLinkActive. */
  @Input() activeSection = '';

  sidebarOpen = signal(false);
}
