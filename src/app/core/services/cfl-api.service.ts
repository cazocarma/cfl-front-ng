import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_BASE = 'http://localhost:4000';

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PagedResponse<T> {
  data: T[];
  pagination: Pagination;
}

@Injectable({ providedIn: 'root' })
export class CflApiService {
  constructor(private http: HttpClient) {}

  // ── Dashboard: candidatos SAP (no ingresados) ──────────────────────────────
  getMissingFletes(params: Record<string, unknown> = {}): Observable<PagedResponse<unknown>> {
    return this.http.get<PagedResponse<unknown>>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados`,
      { params: this._toHttpParams(params) }
    );
  }

  // ── Dashboard: fletes en curso (completos sin folio) ──────────────────────
  getCompletosSinFolio(params: Record<string, unknown> = {}): Observable<PagedResponse<unknown>> {
    return this.http.get<PagedResponse<unknown>>(
      `${API_BASE}/api/dashboard/fletes/completos-sin-folio`,
      { params: this._toHttpParams(params) }
    );
  }

  getMissingFleteDetalle(id: number): Observable<unknown> {
    return this.http.get<unknown>(`${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/detalle`);
  }

  ingresarFletePendiente(id: number): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/ingresar`,
      {}
    );
  }

  crearCabeceraDesdeCandidato(id: number, body: unknown): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/crear`,
      body
    );
  }

  asignarNuevoFolio(body: { ids_cabecera_flete: number[] }): Observable<{ data: { folio_numero: string } }> {
    return this.http.post<{ data: { folio_numero: string } }>(
      `${API_BASE}/api/dashboard/folios/asignar-nuevo`,
      body
    );
  }

  anularFlete(id: number): Observable<unknown> {
    return this.http.post<unknown>(`${API_BASE}/api/dashboard/fletes/${id}/anular`, {});
  }

  // ── Fletes CRUD ───────────────────────────────────────────────────────────
  getFleteById(id: number): Observable<unknown> {
    return this.http.get<unknown>(`${API_BASE}/api/fletes/${id}`);
  }

  updateFleteById(id: number, body: unknown): Observable<unknown> {
    return this.http.put<unknown>(`${API_BASE}/api/fletes/${id}`, body);
  }

  crearFleteManual(body: unknown): Observable<unknown> {
    return this.http.post<unknown>(`${API_BASE}/api/fletes/manual`, body);
  }

  // ── Mantenedores ──────────────────────────────────────────────────────────
  listMaintainerRows(entity: string, params: Record<string, unknown> = {}): Observable<{ data: unknown[] }> {
    return this.http.get<{ data: unknown[] }>(
      `${API_BASE}/api/mantenedores/${entity}`,
      { params: this._toHttpParams(params) }
    );
  }

  private _toHttpParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return params;
  }
}
