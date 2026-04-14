import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppSidebarComponent } from '../../core/components/app-sidebar/app-sidebar.component';

@Component({
    selector: 'app-mantenedores-layout',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterOutlet, AppSidebarComponent],
    template: `
    <div class="flex h-screen overflow-hidden bg-forest-50 font-sans">
      <app-sidebar [open]="sidebarOpen()" (close)="sidebarOpen.set(false)" />

      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <!-- Mobile-only top bar with hamburger -->
        <div class="flex flex-shrink-0 items-center gap-2 border-b border-forest-100 bg-white px-3 py-2 shadow-sm md:hidden">
          <button type="button" (click)="sidebarOpen.set(true)" class="flex-shrink-0 rounded-lg p-2 text-forest-600 transition hover:bg-forest-100" aria-label="Abrir menu">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <span class="text-sm font-semibold text-forest-700">Mantenedores</span>
        </div>
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <router-outlet />
        </div>
      </main>
    </div>
  `
})
export class MantenedoresLayoutComponent {
  sidebarOpen = signal(false);
}
