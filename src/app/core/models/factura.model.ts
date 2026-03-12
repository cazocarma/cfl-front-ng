// Modelos del módulo de facturación

export type EstadoFactura = 'borrador' | 'emitida' | 'anulada';
export type CriterioAgrupacion = 'centro_costo' | 'tipo_flete';

export interface EmpresaElegible {
  id_empresa: number;
  rut: string;
  empresa_nombre: string;
  sap_codigo: string | null;
  folios_disponibles: number;
}

export interface FolioElegible {
  id_folio: number;
  folio_numero: string;
  estado_folio: string;
  id_centro_costo: number;
  centro_costo: string | null;
  centro_costo_codigo: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  total_movimientos: number;
  monto_neto_estimado: number;
  primary_tipo_flete_id: number | null;
  primary_tipo_flete_nombre: string | null;
}

export interface MovimientoFactura {
  id_cabecera_flete: number;
  id_folio: number;
  folio_numero: string;
  sap_numero_entrega: string | null;
  numero_entrega: string | null;
  guia_remision: string | null;
  tipo_movimiento: string;
  estado: string;
  fecha_salida: string;
  monto_aplicado: number;
  tipo_flete_nombre: string | null;
  tipo_flete_codigo: string | null;
  centro_costo: string | null;
  centro_costo_codigo: string | null;
  ruta: string | null;
  empresa_nombre: string | null;
}

export interface FolioFactura {
  id_factura_folio: number;
  id_folio: number;
  folio_numero: string;
  estado_folio: string;
  id_centro_costo: number;
  centro_costo: string | null;
  centro_costo_codigo: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  total_movimientos: number;
  monto_total_movimientos: number;
}

export interface FacturaListItem {
  id_factura: number;
  id_empresa: number;
  empresa_nombre: string;
  numero_factura: string;
  fecha_emision: string;
  moneda: string;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  estado: EstadoFactura;
  criterio_agrupacion: CriterioAgrupacion | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  cantidad_folios: number;
  centro_costos: string | null;
}

export interface FacturaDetalle extends FacturaListItem {
  empresa_rut: string | null;
  folios: FolioFactura[];
  movimientos: MovimientoFactura[];
}

export interface GrupoPreview {
  grupo_clave: string;
  grupo_label: string;
  ids_folio: number[];
  folios: FolioElegible[];
  movimientos: MovimientoFactura[];
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  cantidad_movimientos: number;
}

export interface PreviewResult {
  criterio: CriterioAgrupacion;
  cantidad_facturas: number;
  grupos: GrupoPreview[];
}
