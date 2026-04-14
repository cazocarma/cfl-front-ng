import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../config/api-base';
import { Roles } from '../config/permissions';

interface AuthzContextResponse {
  data: {
    role: string | null;
    roles: string[];
    permissions: string[];
    source: string;
  };
  generated_at: string;
}

export type AuthzLoadState = 'idle' | 'loading' | 'ready' | 'failed';

export class AuthzContextError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthzContextError';
  }
}

/**
 * Contexto de autorización del usuario autenticado.
 *
 * Fuente de verdad: `GET /api/authn/context` del backend, que mezcla rol +
 * permisos calculados desde la BD. El contexto **no** se infiere del JWT —
 * un JWT válido con usuario deshabilitado NO resuelve contexto.
 *
 * Estados:
 *   idle    → aún no intentamos cargar.
 *   loading → request en vuelo.
 *   ready   → contexto cargado correctamente.
 *   failed  → última carga falló (status + message disponibles para UI).
 *
 * Los guards deben esperar `ensureLoaded()` — si resuelve, el contexto es
 * confiable; si rechaza, la sesión no es válida y el consumidor debe forzar
 * logout.
 */
@Injectable({ providedIn: 'root' })
export class AuthzService {
  readonly permissions = signal<Set<string>>(new Set());
  readonly roles = signal<string[]>([]);
  readonly primaryRole = signal<string | null>(null);
  readonly state = signal<AuthzLoadState>('idle');
  readonly lastError = signal<AuthzContextError | null>(null);

  /** Derivado: true sólo cuando hay contexto confiable cargado. */
  readonly loaded = computed(() => this.state() === 'ready');

  private _inflight: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Garantiza que el contexto esté cargado.
   * - Si `ready` → resuelve inmediato.
   * - Si `loading` → se suma a la petición en vuelo.
   * - Si `idle` o `failed` → dispara un nuevo fetch.
   * Rechaza con `AuthzContextError` si el backend responde error.
   */
  ensureLoaded(): Promise<void> {
    if (this.state() === 'ready') return Promise.resolve();
    if (this._inflight) return this._inflight;
    return this.reload();
  }

  /** Fuerza un re-fetch del contexto. Útil tras cambios de rol o reinicio. */
  reload(): Promise<void> {
    this.state.set('loading');
    this._inflight = firstValueFrom(
      this.http.get<AuthzContextResponse>(`${API_BASE}/api/authn/context`),
    )
      .then((res) => {
        // Normalizamos a minúsculas en la frontera: la BD guarda roles con
        // mayúsculas ("Administrador"), las constantes del frontend son
        // minúsculas ("administrador"). Comparar en minúsculas evita toda una
        // clase de bugs case-sensitive en guards y computed signals.
        this.permissions.set(new Set(res.data.permissions.map((p) => p.toLowerCase())));
        this.roles.set(res.data.roles.map((r) => r.toLowerCase()));
        this.primaryRole.set(res.data.role ? res.data.role.toLowerCase() : null);
        this.state.set('ready');
        this.lastError.set(null);
      })
      .catch((err: unknown) => {
        this.clear();
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        const message =
          err instanceof HttpErrorResponse
            ? err.error?.error ?? err.message
            : 'Error desconocido al cargar el contexto de autorización';
        const wrapped = new AuthzContextError(status, message);
        this.state.set('failed');
        this.lastError.set(wrapped);
        throw wrapped;
      })
      .finally(() => {
        this._inflight = null;
      });
    return this._inflight;
  }

  hasPermission(key: string): boolean {
    return this.permissions().has(key);
  }

  hasAnyPermission(...keys: string[]): boolean {
    const perms = this.permissions();
    return keys.some((k) => perms.has(k));
  }

  isAdministrador(): boolean {
    return this.primaryRole() === Roles.ADMINISTRADOR;
  }

  /** Limpia todo el estado. No cambia `state` — eso lo define quien llama. */
  clear(): void {
    this.permissions.set(new Set());
    this.roles.set([]);
    this.primaryRole.set(null);
  }

  /** Reset completo (por logout). */
  reset(): void {
    this.clear();
    this.state.set('idle');
    this.lastError.set(null);
    this._inflight = null;
  }
}
