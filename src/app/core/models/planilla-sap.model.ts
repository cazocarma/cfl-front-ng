export type EstadoPlanilla = 'generada' | 'enviada' | 'anulada';

export interface PlanillaSapListItem {
  id_planilla_sap: number;
  fecha_documento: string;
  fecha_contabilizacion: string;
  glosa_cabecera: string;
  temporada: string | null;
  total_lineas: number;
  total_documentos: number;
  monto_total: number;
  estado: EstadoPlanilla;
  fecha_creacion: string;
  facturas_count: number;
  periodo_label: string | null;
  empresas_nombres: string | null;
}

export interface PlanillaSapLinea {
  id_planilla_sap_linea: number;
  numero_linea: number;
  es_doc_nuevo: boolean;
  clave_contabilizacion: string;
  cuenta_mayor: string | null;
  codigo_proveedor: string | null;
  indicador_cme: string | null;
  importe: number;
  centro_costo: string | null;
  orden_compra: string | null;
  posicion_oc: string | null;
  nro_asignacion: string | null;
  texto_linea: string | null;
  indicador_impuesto: string | null;
  temporada: string | null;
  tipo_cargo_abono: string | null;
}

export interface PlanillaSapDocumento {
  id_planilla_sap_documento: number;
  numero_documento: number;
  centro_costo_codigo: string | null;
  cuenta_mayor_codigo: string | null;
  referencia: string | null;
  numero_pre_factura: string | null;
  monto_debito: number;
  total_lineas: number;
  lineas: PlanillaSapLinea[];
}

export interface PlanillaSapFacturaVinculada {
  id_factura: number;
  numero_factura: string;
  empresa_nombre: string;
}

export interface PlanillaSapDetalle {
  id_planilla_sap: number;
  fecha_documento: string;
  fecha_contabilizacion: string;
  glosa_cabecera: string;
  referencia: string | null;
  sociedad_fi: string;
  clase_documento: string;
  moneda: string;
  temporada: string | null;
  codigo_cargo_abono: string | null;
  glosa_cargo_abono: string | null;
  indicador_impuesto: string;
  total_lineas: number;
  total_documentos: number;
  monto_total: number;
  estado: EstadoPlanilla;
  fecha_creacion: string;
  periodo_label: string;
  empresa_nombre: string;
  facturas: PlanillaSapFacturaVinculada[];
  documentos: PlanillaSapDocumento[];
}

export interface GenerarPlanillaRequest {
  facturas_ids: number[];
  movimientos_ids: number[];
  fecha_documento: string;
  fecha_contabilizacion: string;
  glosa_cabecera: string;
  temporada?: string | null;
  codigo_cargo_abono?: string | null;
  glosa_cargo_abono?: string | null;
  indicador_impuesto?: string;
  productores_oc?: Array<{
    id_productor: number;
    especie?: string;
    orden_compra: string;
    posicion_oc?: string;
  }>;
}

export interface MovimientoPlanillaRow {
  id_cabecera_flete: number;
  id_factura: number;
  numero_factura: string;
  fecha_salida: string;
  numero_guia: string;
  centro_costo_codigo: string;
  cuenta_mayor_codigo: string;
  cuenta_mayor_glosa: string;
  id_productor: number;
  productor_nombre: string;
  codigo_proveedor: string;
  monto_aplicado: number;
  especie_nombre: string | null;
  tipo_flete_nombre: string;
  selected: boolean;
}

export interface ProductorOcRow {
  id_productor: number;
  codigo_proveedor: string;
  nombre: string;
  monto: number;
  especie: string;
  orden_compra: string;
  posicion_oc: string;
}

export interface PosicionOcOption {
  ebelp: string;
  matnr: string;
  txz01: string;
  menge: string;
  meins: string;
}

export interface OrdenCompraOption {
  ebeln: string;
  aedat: string;
  ernam: string;
  bukrs: string;
  bsart: string;
  posiciones: PosicionOcOption[];
}
