import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, of, catchError, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api-base';

interface AuthzContextResponse {
  data: {
    role: string | null;
    roles: string[];
    permissions: string[];
    source: string;
  };
  generated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthzService {
  readonly permissions = signal<Set<string>>(new Set());
  readonly roles = signal<string[]>([]);
  readonly primaryRole = signal<string | null>(null);
  readonly loaded = signal(false);

  private _loading: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Garantiza que el contexto este cargado. Si ya se cargo, retorna inmediato.
   * Si hay una carga en curso, espera esa misma promesa (sin duplicar requests).
   */
  ensureLoaded(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    if (!this._loading) {
      this._loading = firstValueFrom(this.loadContext()).then(() => {
        this._loading = null;
      });
    }
    return this._loading;
  }

  loadContext(): Observable<void> {
    return this.http
      .get<AuthzContextResponse>(`${API_BASE}/api/authn/context`)
      .pipe(
        tap((res) => {
          this.permissions.set(new Set(res.data.permissions));
          this.roles.set(res.data.roles);
          this.primaryRole.set(res.data.role);
          this.loaded.set(true);
        }),
        map(() => undefined),
        catchError(() => {
          this.clear();
          return of(undefined);
        }),
      );
  }

  hasPermission(key: string): boolean {
    return this.permissions().has(key);
  }

  hasAnyPermission(...keys: string[]): boolean {
    const perms = this.permissions();
    return keys.some((k) => perms.has(k));
  }

  clear(): void {
    this.permissions.set(new Set());
    this.roles.set([]);
    this.primaryRole.set(null);
    this.loaded.set(false);
  }
}
