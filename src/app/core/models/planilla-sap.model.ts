export type EstadoPlanilla = 'generada' | 'descargada' | 'contabilizada';

export interface PlanillaSapListItem {
  id_planilla_sap: number;
  id_factura: number;
  numero_factura: string;
  empresa_nombre: string;
  fecha_documento: string;
  fecha_contabilizacion: string;
  glosa_cabecera: string;
  temporada: string | null;
  total_lineas: number;
  total_documentos: number;
  monto_total: number;
  estado: EstadoPlanilla;
  fecha_creacion: string;
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
  monto_debito: number;
  total_lineas: number;
  lineas: PlanillaSapLinea[];
}

export interface PlanillaSapDetalle extends PlanillaSapListItem {
  sociedad_fi: string;
  clase_documento: string;
  moneda: string;
  codigo_cargo_abono: string | null;
  glosa_cargo_abono: string | null;
  indicador_impuesto: string;
  documentos: PlanillaSapDocumento[];
}

export interface GenerarPlanillaRequest {
  id_factura: number;
  fecha_documento: string;
  fecha_contabilizacion: string;
  glosa_cabecera: string;
  temporada?: string | null;
  codigo_cargo_abono?: string | null;
  glosa_cargo_abono?: string | null;
  indicador_impuesto?: string;
  productores_oc?: Array<{
    id_productor: number;
    orden_compra: string;
    posicion_oc?: string;
  }>;
}

export interface ProductorOcRow {
  id_productor: number;
  codigo_proveedor: string;
  nombre: string;
  monto: number;
  especie: string | null;
  orden_compra: string;
  posicion_oc: string;
}
