/**
 * Tipos compartidos del módulo edit-flete-modal.
 */

export type ModalTab = 'cabecera' | 'detalles';
export type ModalMode = 'edit' | 'view' | 'retorno';

export interface DetalleDraft {
  rowId: string;
  id_especie: string;
  material: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  peso: string;
  sap_posicion: string;
  sap_posicion_superior: string;
  sap_lote: string;
}

export interface DetalleGrupo {
  /** Clave de agrupación: material normalizado en mayúsculas, o rowId si no tiene material. */
  materialKey: string;
  material: string;
  descripcion: string;
  cantidad_total: number;
  peso_total: number;
  unidad: string;
  id_especie: string;
  rowIds: string[];
  lotes: string[];
  posicion_count: number;
}

export interface DashboardDetalleResponse {
  data?: {
    cabecera?: Record<string, unknown>;
    posiciones?: Record<string, unknown>[];
  };
}

export interface FleteDetalleResponse {
  data?: {
    cabecera?: Record<string, unknown>;
    detalles?: Record<string, unknown>[];
  };
}

export interface TarifaListResponse {
  data?: unknown[];
  temporada_id?: number | null;
}

export interface CatalogCacheSnapshot {
  loadedAt: number;
  tiposFlete: Record<string, unknown>[];
  tiposCamion: Record<string, unknown>[];
  centrosCosto: Record<string, unknown>[];
  detallesViaje: Record<string, unknown>[];
  nodos: Record<string, unknown>[];
  rutas: Record<string, unknown>[];
  tarifas: Record<string, unknown>[];
  empresas: Record<string, unknown>[];
  choferes: Record<string, unknown>[];
  camiones: Record<string, unknown>[];
  cuentasMayor: Record<string, unknown>[];
  imputacionesFlete: Record<string, unknown>[];
  especies: Record<string, unknown>[];
  productores: Record<string, unknown>[];
  temporadaId: number | null;
  temporadaLabel: string;
}
