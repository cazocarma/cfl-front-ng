import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-mantenedores-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden bg-forest-50 font-sans">

      <!-- ── SIDEBAR ─────────────────────────────────────── -->
      <aside
        class="flex w-64 flex-col flex-shrink-0 overflow-hidden"
        style="background: linear-gradient(180deg, #102614 0%, #1e4424 60%, #25522b 100%);"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-5 py-6 border-b border-forest-800">
          <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-forest-500/30 ring-1 ring-forest-400/40">
            <svg class="h-6 w-6 text-forest-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2 0 0-4-2-8 0-6 3-6 9-6 9s2-1 4-1c0 0 1-3 7-3z"/>
            </svg>
          </div>
          <div>
            <div class="text-base font-bold text-white tracking-tight">CFL</div>
            <div class="text-[10px] text-forest-400 leading-none tracking-wide uppercase">Control de Fletes</div>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-forest-600">Menú principal</p>

          <a routerLink="/bandeja" class="nav-item">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
            <span>Bandeja</span>
          </a>

          <a href="#" class="nav-item">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span>Facturas</span>
          </a>

          <a href="#" class="nav-item">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            <span>Planillas SAP</span>
          </a>

          <!-- Mantenedores (activo) -->
          <a routerLink="/mantenedores" class="nav-item nav-item-active">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span>Mantenedores</span>
          </a>

          <div class="my-3 border-t border-forest-800"></div>
          <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-forest-600">Análisis</p>

          <a href="#" class="nav-item">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span>Estadísticas</span>
          </a>

          <a href="#" class="nav-item">
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span>Auditoría</span>
          </a>
        </nav>

        <!-- User section -->
        <div class="border-t border-forest-800 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-500 text-sm font-bold text-white ring-2 ring-forest-400">
              {{ userInitials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-white">{{ userName }}</p>
              <p class="truncate text-xs text-forest-400">{{ roleLabel }}</p>
            </div>
            <button
              type="button"
              (click)="logout()"
              title="Cerrar sesión"
              class="rounded-lg p-1.5 text-forest-500 transition hover:bg-forest-800 hover:text-red-400"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- ── CONTENT via router-outlet ───────────────────── -->
      <main class="flex flex-1 flex-col overflow-hidden">
        <router-outlet />
      </main>
    </div>
  `,
})
export class MantenedoresLayoutComponent {
  constructor(private auth: AuthService) {}

  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? (u.nombre ? `${u.nombre} ${u.apellido ?? ''}`.trim() : u.username) : 'Usuario';
  }
  get userRole(): string { return this.auth.getCurrentUser()?.role ?? ''; }
  get roleLabel(): string {
    const map: Record<string, string> = {
      ingresador: 'Ingresador', autorizador: 'Autorizador', administrador: 'Administrador',
    };
    return map[this.userRole] ?? this.userRole;
  }
  get userInitials(): string {
    return this.userName.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  }
  logout(): void { this.auth.logout(); }
}
