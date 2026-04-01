import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../config/api-base';
import {
  ControlFleteCargaJobListResponse,
  ControlFleteCargaJobResponse,
  SolicitarControlFleteCargaPorRangoFechasRequest,
  SolicitarControlFleteCargaPorVbelnRequest,
  SolicitarControlFleteCargaPorXblnrRequest,
} from '../models/control-flete-carga-job.model';
import {
  CandidatoRow,
  FleteEnCursoRow,
} from '../models/flete.model';
import {
  EmpresaElegible,
  FacturaDetalle,
  FacturaListItem,
  GrupoSugerido,
  MovimientoElegible,
  PeriodoDisponible,
  PreviewResult,
} from '../models/factura.model';
import {
  GenerarPlanillaRequest,
  MovimientoPlanillaRow,
  PlanillaSapDetalle,
  PlanillaSapListItem,
} from '../models/planilla-sap.model';

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
  getMissingFletes(params: Record<string, unknown> = {}): Observable<PagedResponse<CandidatoRow>> {
    return this.http.get<PagedResponse<CandidatoRow>>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados`,
      { params: this._toHttpParams(params) }
    );
  }

  // ── Dashboard: fletes completados ──────────────────────────────────────────
  getCompletados(params: Record<string, unknown> = {}): Observable<PagedResponse<FleteEnCursoRow>> {
    return this.http.get<PagedResponse<FleteEnCursoRow>>(
      `${API_BASE}/api/dashboard/fletes/completados`,
      { params: this._toHttpParams(params) }
    );
  }

  solicitarControlFleteCargaPorVbeln(
    body: SolicitarControlFleteCargaPorVbelnRequest,
  ): Observable<ControlFleteCargaJobResponse> {
    return this.http.post<ControlFleteCargaJobResponse>(
      `${API_BASE}/api/fletes/cargas-sap/vbeln`,
      body
    );
  }

  solicitarControlFleteCargaPorXblnr(
    body: SolicitarControlFleteCargaPorXblnrRequest,
  ): Observable<ControlFleteCargaJobResponse> {
    return this.http.post<ControlFleteCargaJobResponse>(
      `${API_BASE}/api/fletes/cargas-sap/xblnr`,
      body
    );
  }

  solicitarControlFleteCargaPorRangoFechas(
    body: SolicitarControlFleteCargaPorRangoFechasRequest,
  ): Observable<ControlFleteCargaJobResponse> {
    return this.http.post<ControlFleteCargaJobResponse>(
      `${API_BASE}/api/fletes/cargas-sap/rango-fechas`,
      body
    );
  }

  getControlFleteCargaJob(jobId: string): Observable<ControlFleteCargaJobResponse> {
    return this.http.get<ControlFleteCargaJobResponse>(
      `${API_BASE}/api/fletes/cargas-sap/jobs/${encodeURIComponent(jobId)}`
    );
  }

  getControlFleteCargaLatestJob(): Observable<ControlFleteCargaJobResponse> {
    return this.http.get<ControlFleteCargaJobResponse>(
      `${API_BASE}/api/fletes/cargas-sap/jobs/ultimo`
    );
  }

  getControlFleteCargaRecentJobs(limit = 20): Observable<ControlFleteCargaJobListResponse> {
    return this.http.get<ControlFleteCargaJobListResponse>(
      `${API_BASE}/api/fletes/cargas-sap/jobs`,
      { params: { limit: limit.toString() } }
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

  descartarFletePendiente(id: number, body: { motivo?: string | null } = {}): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/descartar`,
      { motivo: body.motivo ?? null }
    );
  }

  restaurarFletePendiente(id: number): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/restaurar`,
      {}
    );
  }

  crearCabeceraDesdeCandidato(id: number, body: unknown): Observable<unknown> {
    return this.http.post<unknown>(
      `${API_BASE}/api/dashboard/fletes/no-ingresados/${id}/crear`,
      body
    );
  }

  anularFlete(id: number, body: { motivo?: string | null } = {}): Observable<unknown> {
    return this.http.post<unknown>(`${API_BASE}/api/dashboard/fletes/${id}/anular`, {
      motivo: body.motivo ?? null,
    });
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

  toggleMaintainerActivo(
    entity: string,
    id: number,
    activo: boolean,
    fieldName = 'activo',
  ): Observable<unknown> {
    // Para usuarios se usa el endpoint especial; para el resto se hace PUT con el campo
    if (entity === 'usuarios') {
      return this.http.patch<unknown>(
        `${API_BASE}/api/mantenedores/usuarios/${id}/estado`, { activo }
      );
    }
    return this.http.put<unknown>(
      `${API_BASE}/api/mantenedores/${entity}/${id}`,
      { [fieldName]: activo },
    );
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
  getAuthzContext(): Observable<{
    data: {
      role: string | null;
      roles: string[];
      permissions: string[];
      source: string | null;
    };
  }> {
    return this.http.get<{
      data: {
        role: string | null;
        roles: string[];
        permissions: string[];
        source: string | null;
      };
    }>(
      `${API_BASE}/api/authn/context`
    );
  }

  // —— Operaciones: Facturas / Planillas / Estadísticas / Auditoría ————————
  getFacturasOverview(): Observable<{ data: unknown; permissions?: unknown }> {
    return this.http.get<{ data: unknown; permissions?: unknown }>(
      `${API_BASE}/api/operaciones/facturas/overview`
    );
  }

  getPlanillasSapOverview(): Observable<{ data: unknown; permissions?: unknown }> {
    return this.http.get<{ data: unknown; permissions?: unknown }>(
      `${API_BASE}/api/operaciones/planillas-sap/overview`
    );
  }

  // --- Planillas SAP (generadas) ---

  getPlanillasSapList(): Observable<{ data: PlanillaSapListItem[] }> {
    return this.http.get<{ data: PlanillaSapListItem[] }>(`${API_BASE}/api/planillas-sap`);
  }

  getPlanillaSapDetalle(id: number): Observable<{ data: PlanillaSapDetalle }> {
    return this.http.get<{ data: PlanillaSapDetalle }>(`${API_BASE}/api/planillas-sap/${id}`);
  }

  getPlanillaMovimientos(facturasIds: number[]): Observable<{ data: MovimientoPlanillaRow[] }> {
    const params = new HttpParams().set('facturas_ids', facturasIds.join(','));
    return this.http.get<{ data: MovimientoPlanillaRow[] }>(
      `${API_BASE}/api/planillas-sap/movimientos`, { params }
    );
  }

  generarPlanillaSap(body: GenerarPlanillaRequest): Observable<{ data: { id_planilla_sap: number }; warnings?: string[] }> {
    return this.http.post<{ data: { id_planilla_sap: number }; warnings?: string[] }>(`${API_BASE}/api/planillas-sap/generar`, body);
  }

  exportarPlanillaSap(id: number): Observable<Blob> {
    return this.http.get(`${API_BASE}/api/planillas-sap/${id}/export`, { responseType: 'blob' });
  }

  cambiarEstadoPlanilla(id: number, estado: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${API_BASE}/api/planillas-sap/${id}/estado`, { estado });
  }

  getPlanillaFacturasElegibles(id: number): Observable<{ data: Array<Record<string, unknown>> }> {
    return this.http.get<{ data: Array<Record<string, unknown>> }>(`${API_BASE}/api/planillas-sap/${id}/facturas-elegibles`);
  }

  agregarFacturasPlanilla(id: number, facturasIds: number[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE}/api/planillas-sap/${id}/facturas`, { facturas_ids: facturasIds });
  }

  quitarFacturaPlanilla(id: number, idFactura: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_BASE}/api/planillas-sap/${id}/facturas/${idFactura}`);
  }

  getEstadisticasOverview(): Observable<{ data: unknown }> {
    return this.http.get<{ data: unknown }>(
      `${API_BASE}/api/operaciones/estadisticas/overview`
    );
  }

  getAuditoriaOverview(limit?: number): Observable<{ data: unknown }> {
    const params: Record<string, unknown> = {};
    if (limit) params['limit'] = limit;

    return this.http.get<{ data: unknown }>(
      `${API_BASE}/api/operaciones/auditoria/overview`,
      { params: this._toHttpParams(params) }
    );
  }

  // ── Facturas: módulo de facturación ───────────────────────────────────────

  getFacturasLista(params: Record<string, unknown> = {}): Observable<{ data: FacturaListItem[] }> {
    return this.http.get<{ data: FacturaListItem[] }>(
      `${API_BASE}/api/facturas`,
      { params: this._toHttpParams(params) }
    );
  }

  getFacturasEmpresasElegibles(): Observable<{ data: EmpresaElegible[] }> {
    return this.http.get<{ data: EmpresaElegible[] }>(`${API_BASE}/api/facturas/empresas-elegibles`);
  }

  getFacturasPeriodosConMovimientos(idEmpresa: number): Observable<{ data: PeriodoDisponible[] }> {
    return this.http.get<{ data: PeriodoDisponible[] }>(
      `${API_BASE}/api/facturas/periodos-con-movimientos`,
      { params: this._toHttpParams({ id_empresa: idEmpresa }) }
    );
  }

  getMovimientosElegibles(idEmpresa: number, desde: string, hasta: string): Observable<{ data: { movimientos: MovimientoElegible[]; grupos_sugeridos: GrupoSugerido[] } }> {
    return this.http.get<{ data: { movimientos: MovimientoElegible[]; grupos_sugeridos: GrupoSugerido[] } }>(
      `${API_BASE}/api/facturas/movimientos-elegibles`,
      { params: this._toHttpParams({ id_empresa: idEmpresa, desde, hasta }) }
    );
  }

  getFacturaPreviewNueva(body: { id_empresa: number; grupos: { ids_cabecera_flete: number[] }[] }): Observable<{ data: PreviewResult }> {
    return this.http.post<{ data: PreviewResult }>(`${API_BASE}/api/facturas/preview`, body);
  }

  generarFacturas(body: { id_empresa: number; grupos: { ids_cabecera_flete: number[] }[] }): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(`${API_BASE}/api/facturas/generar`, body);
  }

  getFacturaDetalle(id: number): Observable<{ data: FacturaDetalle }> {
    return this.http.get<{ data: FacturaDetalle }>(`${API_BASE}/api/facturas/${id}`);
  }

  actualizarFactura(id: number, body: { observaciones?: string | null; criterio_agrupacion?: string }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${API_BASE}/api/facturas/${id}`, body);
  }

  cambiarEstadoFactura(id: number, estado: string, extras?: { numero_factura_recibida?: string }): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${API_BASE}/api/facturas/${id}/estado`, { estado, ...extras });
  }

  agregarMovimientosAFactura(id: number, ids: number[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE}/api/facturas/${id}/movimientos`, { ids_cabecera_flete: ids });
  }

  quitarMovimientoDeFactura(id: number, idFlete: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_BASE}/api/facturas/${id}/movimientos/${idFlete}`);
  }

  exportarFacturaExcel(id: number): Observable<Blob> {
    return this.http.get(`${API_BASE}/api/facturas/${id}/export/excel`, { responseType: 'blob' });
  }

  exportarFacturaPdf(id: number): Observable<Blob> {
    return this.http.get(`${API_BASE}/api/facturas/${id}/export/pdf`, { responseType: 'blob' });
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
