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
  listMaintainerRows(entity: string, params: Record<string, unknown> = {}): Observable<{ data: unknown[]; permissions?: unknown }> {
    return this.http.get<{ data: unknown[]; permissions?: unknown }>(
      `${API_BASE}/api/mantenedores/${entity}`,
      { params: this._toHttpParams(params) }
    );
  }

  getMaintainerRow(entity: string, id: number): Observable<{ data: unknown }> {
    return this.http.get<{ data: unknown }>(`${API_BASE}/api/mantenedores/${entity}/${id}`);
  }

  createMaintainerRow(entity: string, body: unknown): Observable<{ data: unknown; message: string }> {
    return this.http.post<{ data: unknown; message: string }>(
      `${API_BASE}/api/mantenedores/${entity}`, body
    );
  }

  updateMaintainerRow(entity: string, id: number, body: unknown): Observable<{ data: unknown; message: string }> {
    return this.http.put<{ data: unknown; message: string }>(
      `${API_BASE}/api/mantenedores/${entity}/${id}`, body
    );
  }

  deleteMaintainerRow(entity: string, id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_BASE}/api/mantenedores/${entity}/${id}`);
  }

  toggleMaintainerActivo(entity: string, id: number, activo: boolean): Observable<unknown> {
    // Para usuarios se usa el endpoint especial; para el resto se hace PUT con el campo
    if (entity === 'usuarios') {
      return this.http.patch<unknown>(
        `${API_BASE}/api/mantenedores/usuarios/${id}/estado`, { activo }
      );
    }
    return this.http.put<unknown>(`${API_BASE}/api/mantenedores/${entity}/${id}`, { activo });
  }

  // ── Mantenedores: Tarifas ──────────────────────────────────────────────────
  listTarifas(temporadaId?: number): Observable<{ data: unknown[]; temporada_id: number | null }> {
    const params: Record<string, unknown> = {};
    if (temporadaId) params['temporada_id'] = temporadaId;
    return this.http.get<{ data: unknown[]; temporada_id: number | null }>(
      `${API_BASE}/api/mantenedores/tarifas`,
      { params: this._toHttpParams(params) }
    );
  }

  getTemporadaActiva(): Observable<{ data: unknown }> {
    return this.http.get<{ data: unknown }>(`${API_BASE}/api/mantenedores/temporadas/activa`);
  }

  // ── Mantenedores: Folios ───────────────────────────────────────────────────
  getFolioMovimientos(idFolio: number): Observable<{ data: unknown[]; estado_folio: string; total: number }> {
    return this.http.get<{ data: unknown[]; estado_folio: string; total: number }>(
      `${API_BASE}/api/mantenedores/folios/${idFolio}/movimientos`
    );
  }

  asignarSapAFolio(idFolio: number, sapNumeroEntrega: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/mantenedores/folios/${idFolio}/movimientos/asignar-sap`,
      { sap_numero_entrega: sapNumeroEntrega }
    );
  }

  desasignarMovimientoDeFolio(idFolio: number, idCabeceraFlete: number): Observable<unknown> {
    return this.http.patch<unknown>(
      `${API_BASE}/api/mantenedores/folios/${idFolio}/movimientos/${idCabeceraFlete}/desasignar`,
      {}
    );
  }

  toggleFolioBloqueo(idFolio: number, bloqueado: boolean): Observable<{ data: unknown; message: string }> {
    return this.http.patch<{ data: unknown; message: string }>(
      `${API_BASE}/api/mantenedores/folios/${idFolio}/bloqueo`,
      { bloqueado }
    );
  }

  // ── Mantenedores: Usuarios / Roles ────────────────────────────────────────
  getUserRoles(idUsuario: number): Observable<{ data: unknown[] }> {
    return this.http.get<{ data: unknown[] }>(
      `${API_BASE}/api/mantenedores/usuarios/${idUsuario}/roles`
    );
  }

  assignUserRole(idUsuario: number, idRol: number): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/mantenedores/usuarios/${idUsuario}/roles`, { id_rol: idRol }
    );
  }

  removeUserRole(idUsuario: number, idRol: number): Observable<unknown> {
    return this.http.delete<unknown>(
      `${API_BASE}/api/mantenedores/usuarios/${idUsuario}/roles/${idRol}`
    );
  }

  // ── Auth context ──────────────────────────────────────────────────────────
  getAuthContext(): Observable<{ data: { role: string; permissions: string[] } }> {
    return this.http.get<{ data: { role: string; permissions: string[] } }>(
      `${API_BASE}/api/auth/context`
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
