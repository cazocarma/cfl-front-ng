import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class AuthnService {
  private readonly authz = inject(AuthzService);
  readonly currentUser = signal<JwtUser | null>(this._parseToken());

  constructor(private http: HttpClient, private router: Router) {
    if (this.isLoggedIn()) {
      this.authz.loadContext().subscribe();
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/api/authn/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          this.currentUser.set(res.user);
          this.authz.loadContext().subscribe();
        })
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
    this.authz.clear();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = this._decodePayload(token);
      if (!payload?.exp) return false; // sin expiración = token inválido
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
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as JwtPayload;
  }
}
