export type ControlFleteCargaJobTipoSolicitud = 'vbeln' | 'xblnr' | 'rango_fechas';

export type ControlFleteCargaJobEstado =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface ControlFleteCargaJobParametros {
  vbeln?: string[] | null;
  xblnr?: string[] | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
}

export interface ControlFleteCargaJobResumen {
  solicitados?: number | null;
  procesados?: number | null;
  insertados_raw?: number | null;
  actualizados_canonicos?: number | null;
  omitidos?: number | null;
  errores?: number | null;
}

export interface ControlFleteCargaJobResultadoItem {
  vbeln?: string | null;
  sap_numero_entrega?: string | null;
  estado?: string | null;
  accion?: string | null;
  detalle?: string | null;
  id_sap_entrega?: number | null;
  id_cabecera_flete?: number | null;
}

export interface ControlFleteCargaJobErrorItem {
  codigo?: string | null;
  mensaje?: string | null;
  detalle?: string | null;
  vbeln?: string | null;
  etapa?: string | null;
}

export interface ControlFleteCargaJob {
  job_id: string;
  tipo_solicitud: ControlFleteCargaJobTipoSolicitud;
  estado: string;
  etapa_actual?: string | null;
  mensaje?: string | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
  iniciado_en?: string | null;
  finalizado_en?: string | null;
  porcentaje_avance?: number | null;
  source_system?: string | null;
  poll_interval_ms?: number | null;
  parametros?: ControlFleteCargaJobParametros | null;
  resumen?: ControlFleteCargaJobResumen | null;
  resultados?: ControlFleteCargaJobResultadoItem[] | null;
  errores?: ControlFleteCargaJobErrorItem[] | null;
}

export interface SolicitarControlFleteCargaPorVbelnRequest {
  vbeln?: string[];
  source_system?: string | null;
}

export interface SolicitarControlFleteCargaPorXblnrRequest {
  xblnr?: string[];
  source_system?: string | null;
}

export interface SolicitarControlFleteCargaPorRangoFechasRequest {
  fecha_desde: string;
  fecha_hasta: string;
  source_system?: string | null;
}

export interface ControlFleteCargaJobResponse {
  data: ControlFleteCargaJob;
  message?: string;
}

export interface ControlFleteCargaJobListResponse {
  data: ControlFleteCargaJob[];
}

const TERMINAL_STATES = new Set<ControlFleteCargaJobEstado>([
  'COMPLETED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
]);

export function normalizeControlFleteCargaJobEstado(
  estado: string | null | undefined,
): ControlFleteCargaJobEstado {
  const normalized = String(estado ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'PENDING':
      return 'PENDING';
    case 'QUEUED':
      return 'QUEUED';
    case 'RUNNING':
    case 'IN_PROGRESS':
      return 'RUNNING';
    case 'COMPLETED':
    case 'SUCCESS':
      return 'COMPLETED';
    case 'PARTIAL_SUCCESS':
    case 'PARTIAL':
      return 'PARTIAL_SUCCESS';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return 'UNKNOWN';
  }
}

export function isControlFleteCargaJobTerminal(
  estado: string | null | undefined,
): boolean {
  return TERMINAL_STATES.has(normalizeControlFleteCargaJobEstado(estado));
}
