import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthnService } from './authn.service';
import { AuthzService } from './authz.service';
import { ToastService } from './toast.service';

/**
 * Vigilante de sesión.
 *
 * Detecta tres situaciones y en todas ellas fuerza logout + toast + redirect:
 *  1) Token local con `exp < now` (cacheado pero expirado).
 *  2) Backend rechaza el token (401 en `/context` o revocación vía blocklist).
 *  3) Usuario desactivado en BD (403 en `/context`).
 *
 * Mecanismo:
 *  - Chequeo inicial al bootstrap.
 *  - Chequeo periódico cada 60s (captura expiración mientras el usuario está
 *    inactivo).
 *  - Chequeo en cada `NavigationEnd` (captura el caso de click-en-menu después
 *    de expirar).
 *
 * El chequeo contra backend reutiliza `AuthzService.reload()` — si el contexto
 * se pudo refrescar, la sesión es válida; si no, se rompe la sesión.
 */
@Injectable({ providedIn: 'root' })
export class SessionWatcherService {
  private readonly auth = inject(AuthnService);
  private readonly authz = inject(AuthzService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Intervalo del revalidado contra backend (ms). */
  private static readonly BACKEND_REVALIDATE_MS = 60_000;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Chequeo local en cada navegación.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.checkLocal());

    // Revalidado periódico contra backend.
    this.intervalHandle ??= setInterval(
      () => this.revalidateBackend(),
      SessionWatcherService.BACKEND_REVALIDATE_MS,
    );

    // Chequeo inicial local + intento de carga del contexto si aún no está.
    this.checkLocal();
    this.revalidateBackend();
  }

  private checkLocal(): void {
    const token = this.auth.getToken();
    if (!token) return;
    if (this.auth.isLoggedIn()) return;

    this.toast.show('Tu sesión expiró. Inicia sesión nuevamente.', true);
    this.auth.logout();
  }

  private revalidateBackend(): void {
    const token = this.auth.getToken();
    if (!token) return;
    if (!this.auth.isLoggedIn()) return; // el checkLocal ya hará logout

    this.authz.reload().catch(() => {
      // El guard o el interceptor ya habrán mostrado el toast apropiado; acá
      // simplemente forzamos el logout para dejar la app en estado consistente.
      this.auth.logout();
    });
  }
}
