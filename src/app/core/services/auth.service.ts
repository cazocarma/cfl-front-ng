import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../config/api-base';

export interface JwtUser {
  id_usuario: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  role: string | null;
}

export interface LoginResponse {
  token: string;
  user: JwtUser;
}

const TOKEN_KEY = 'cfl_auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<JwtUser | null>(this._parseToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/api/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          this.currentUser.set(res.user);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = this._decodePayload(token) as any;
      if (!payload?.exp) return true; // sin expiración, asumimos válido
      return (payload.exp as number) * 1000 > Date.now();
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this._decodePayload(token) as unknown as JwtUser;
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _decodePayload(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  }
}
