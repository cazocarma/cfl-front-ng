/**
 * Tipos compartidos del módulo edit-flete-modal.
 */

export type ModalTab = 'cabecera' | 'detalles';
export type ModalMode = 'edit' | 'view' | 'clonar';

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

/** Agrupa filas DetalleDraft por material (uppercase, trimmed). */
export function groupDetailRows(rows: DetalleDraft[]): DetalleGrupo[] {
  const groups = new Map<string, DetalleGrupo>();
  for (const row of rows) {
    const mat = (row.material || '').trim().toUpperCase();
    const key = mat || row.rowId;
    if (!groups.has(key)) {
      groups.set(key, {
        materialKey: key,
        material: row.material,
        descripcion: row.descripcion,
        cantidad_total: Number(row.cantidad) || 0,
        peso_total: Number(row.peso) || 0,
        unidad: row.unidad || 'UN',
        id_especie: row.id_especie,
        rowIds: [row.rowId],
        lotes: row.sap_lote ? [row.sap_lote] : [],
        posicion_count: 1,
      });
    } else {
      const g = groups.get(key)!;
      g.cantidad_total += Number(row.cantidad) || 0;
      g.peso_total += Number(row.peso) || 0;
      g.rowIds.push(row.rowId);
      g.posicion_count++;
      if (row.sap_lote && !g.lotes.includes(row.sap_lote)) g.lotes.push(row.sap_lote);
      if (!g.id_especie && row.id_especie) g.id_especie = row.id_especie;
    }
  }
  return Array.from(groups.values());
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
