import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthnService } from '../../core/services/authn.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    template: `
    <!-- Full-screen nature gradient backdrop -->
    <div
      class="min-h-screen flex items-center justify-center relative overflow-hidden"
      style="background: linear-gradient(135deg, #102614 0%, #1e4424 40%, #2b6734 70%, #45a054 100%);"
    >
      <!-- Decorative leaf blobs -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
             style="background: radial-gradient(circle, #6dbc7a, transparent)"></div>
        <div class="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
             style="background: radial-gradient(circle, #45a054, transparent)"></div>
        <svg class="absolute bottom-0 left-0 opacity-10 w-96" viewBox="0 0 400 400" fill="none">
          <path d="M0 400 Q100 200 200 0 Q300 200 400 400Z" fill="#9fd8a8"/>
        </svg>
        <svg class="absolute top-0 right-0 opacity-10 w-64" viewBox="0 0 300 300" fill="none">
          <path d="M300 0 Q150 150 0 300 Q150 150 300 0Z" fill="#c8eacd"/>
        </svg>
      </div>

      <!-- Login card -->
      <div class="relative z-10 w-full max-w-md mx-4 animate-slide-down">
        <div class="rounded-3xl bg-white/95 backdrop-blur-xl shadow-nature-lg overflow-hidden">

          <!-- Card header with forest gradient -->
          <div class="px-8 pt-10 pb-8 text-center"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <!-- Logo -->
            <div class="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur mb-4 ring-2 ring-white/20 p-2">
              <img src="/logo.png" alt="Greenvic" class="w-full h-full object-contain" />
            </div>
            <h1 class="text-2xl font-bold text-white tracking-tight">Control de Fletes</h1>
            <p class="mt-1 text-forest-200 text-sm">Greenvic — Plataforma Logística</p>
          </div>

          <!-- Form body -->
          <div class="px-8 py-8">
            <h2 class="text-lg font-semibold text-forest-900 mb-1">Bienvenido</h2>
            <p class="text-sm text-forest-600 mb-6">Ingresa tus credenciales para continuar</p>

            <form (ngSubmit)="onSubmit()" class="space-y-5">

              <!-- Email -->
              <div>
                <label class="block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5" for="email">
                  Correo electrónico
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    class="cfl-input pl-10"
                    placeholder="usuario@greenvic.cl"
                    [ngModel]="email()"
                    (ngModelChange)="email.set($event)"
                    name="email"
                    required
                    autocomplete="email"
                  />
                </div>
              </div>

              <!-- Contraseña -->
              <div>
                <label class="block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5" for="password">
                  Contraseña
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    type="password"
                    class="cfl-input pl-10"
                    placeholder="••••••••"
                    [ngModel]="password()"
                    (ngModelChange)="password.set($event)"
                    name="password"
                    required
                    autocomplete="current-password"
                  />
                </div>
              </div>

              <!-- Error message -->
              @if (errorMsg()) {
                <div role="alert" aria-live="assertive" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ errorMsg() }}
                </div>
              }

              <!-- Submit -->
              <button
                type="submit"
                [disabled]="!email().trim() || !password() || loading()"
                class="btn-primary w-full justify-center py-3 text-base mt-2 disabled:cursor-not-allowed"
              >
                @if (loading()) {
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Verificando...
                } @else {
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                  </svg>
                  Ingresar al sistema
                }
              </button>

            </form>
          </div>

          <!-- Footer -->
          <div class="px-8 pb-6 text-center text-xs text-forest-400">
            CFL v0.1 — Greenvic &copy; {{ currentYear }}
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private destroyRef = inject(DestroyRef);
  email    = signal('');
  password = signal('');
  loading  = signal(false);
  errorMsg = signal('');
  currentYear = new Date().getFullYear();

  constructor(private auth: AuthnService, private router: Router) {}

  onSubmit(): void {
    if (!this.email().trim() || !this.password() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login(this.email().trim(), this.password()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.router.navigate(['/bandeja']);
      },
      error: (err) => {
        const msg =
          err?.error?.error ||
          (err?.status === 0 ? 'No se pudo conectar al servidor.' : 'Error al iniciar sesión.');
        this.errorMsg.set(msg);
        this.loading.set(false);
      },
    });
  }
}
