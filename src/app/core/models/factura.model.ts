// Modelos del módulo de facturación

export type EstadoFactura = 'borrador' | 'recibida' | 'anulada';
export type CriterioAgrupacion = 'centro_costo' | 'tipo_flete';

export interface EmpresaElegible {
  id_empresa: number;
  rut: string;
  empresa_nombre: string;
  sap_codigo: string | null;
  movimientos_disponibles: number;
}

export interface PeriodoDisponible {
  anio: number;
  mes: number;
  total_movimientos: number;
  monto_neto: number;
}

export interface MovimientoElegible {
  id_cabecera_flete: number;
  guia_remision: string | null;
  sap_numero_entrega: string | null;
  tipo_flete_id: number;
  tipo_flete_nombre: string;
  centro_costo: string;
  centro_costo_codigo: string;
  fecha_salida: string;
  monto_aplicado: number;
}

export interface GrupoSugerido {
  tipo_flete_id: number;
  tipo_flete_nombre: string;
  ids_cabecera_flete: number[];
}

export interface MovimientoFactura {
  id_cabecera_flete: number;
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
  empresa_rut: string | null;
  chofer_nombre: string | null;
  chofer_rut: string | null;
  camion_patente: string | null;
  camion_carro: string | null;
  tipo_camion: string | null;
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
  numero_factura_recibida: string | null;
  created_at: string;
  updated_at: string;
  cantidad_movimientos: number;
  centro_costos: string | null;
}

export interface FacturaDetalle extends FacturaListItem {
  empresa_rut: string | null;
  movimientos: MovimientoFactura[];
}

export interface GrupoPreview {
  grupo_clave: string;
  grupo_label: string;
  ids_cabecera_flete: number[];
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
