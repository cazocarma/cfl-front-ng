import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from, switchMap } from 'rxjs';

import { API_BASE } from '../config/api-base';
import { AuthzService } from './authz.service';

export interface JwtUser {
  id_usuario: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  role: string | null;
}

interface JwtPayload extends JwtUser {
  exp?: number;
  iat?: number;
  jti?: string;
}

export interface LoginResponse {
  token: string;
  user: JwtUser;
}

const TOKEN_KEY = 'cfl_authn_token';

/**
 * Servicio de autenticación.
 *
 * Responsabilidades:
 *  - Login: POST /api/authn/login → guarda token + carga contexto de autz
 *    (espera a que el contexto esté ready antes de completar el observable).
 *  - Logout: limpia token, resetea authz y redirige a /login.
 *  - `isLoggedIn()`: validación local barata (firma + exp). No sustituye la
 *    validación del backend; los guards además deben esperar `authz.ensureLoaded`
 *    para confirmar que el token es válido server-side.
 */
@Injectable({ providedIn: 'root' })
export class AuthnService {
  private readonly authz = inject(AuthzService);
  readonly currentUser = signal<JwtUser | null>(this._parseToken());

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Login: persiste el token, carga el contexto de autz y completa.
   * Si el contexto no carga (usuario desactivado, sin rol, etc.), el login
   * se considera fallido: se limpia el token y se rechaza con el error.
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/api/authn/login`, { email, password })
      .pipe(
        switchMap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          this.currentUser.set(res.user);
          return from(
            this.authz.reload().then(
              () => res,
              (err) => {
                // Rollback: el token es inútil sin contexto.
                localStorage.removeItem(TOKEN_KEY);
                this.currentUser.set(null);
                throw err;
              },
            ),
          );
        }),
      );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${API_BASE}/api/authn/logout`, {}).subscribe({
        error: (err) => console.warn('logout request failed', err?.status),
      });
    }
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.authz.reset();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Validación local del JWT: firma-format + expiración. No garantiza que el
   * backend acepte el token (pudo haber sido revocado); para eso, los guards
   * esperan `authz.ensureLoaded()`.
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = this._decodePayload(token);
      if (!payload?.exp) return false;
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getCurrentUser(): JwtUser | null {
    return this._parseToken();
  }

  private _parseToken(): JwtUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      return this._decodePayload(token) as JwtUser;
    } catch {
      return null;
    }
  }

  private _decodePayload(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as JwtPayload;
  }
}
