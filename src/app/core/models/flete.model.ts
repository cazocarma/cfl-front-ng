export interface CandidatoRow {
  id_sap_entrega: number;
  sap_numero_entrega: string;
  source_system: string | null;
  estado: string;
  sap_guia_remision: string | null;
  sap_codigo_tipo_flete: string | null;
  sap_centro_costo: string | null;
  sap_cuenta_mayor: string | null;
  sap_fecha_salida: string | null;
  sap_hora_salida: string | null;
  sap_empresa_transporte: string | null;
  sap_nombre_chofer: string | null;
  sap_patente: string | null;
  sap_carro: string | null;
  tipo_flete_nombre: string | null;
  id_tipo_flete: number | null;
  id_centro_costo: number | null;
  puede_ingresar: boolean;
  motivo_no_ingreso: string | null;
}

export interface FleteEnCursoRow {
  id_cabecera_flete: number;
  id_sap_entrega: number | null;
  id_tipo_flete: number | null;
  id_centro_costo: number | null;
  id_detalle_viaje: number | null;
  id_movil: number | null;
  id_tarifa: number | null;
  id_cuenta_mayor: number | null;
  id_ruta: number | null;
  folio_numero: string | null;
  estado: string;
  tipo_flete_nombre: string | null;
  ruta_nombre: string | null;
  ruta_origen_nombre: string | null;
  ruta_destino_nombre: string | null;
  movil_empresa: string | null;
  movil_chofer_rut: string | null;
  movil_chofer_nombre: string | null;
  movil_tipo_camion: string | null;
  movil_patente: string | null;
  sap_empresa_transporte: string | null;
  sap_nombre_chofer: string | null;
  sap_patente: string | null;
  sap_carro: string | null;
  fecha_salida: string | null;
  monto_aplicado: number | null;
  numero_guia: string | null;
  sap_guia_remision: string | null;
  guia_remision: string | null;
  numero_entrega: string | null;
  sap_numero_entrega: string | null;
}

export interface FleteTabla {
  kind: 'candidato' | 'en_curso';
  id: string;
  idSapEntrega?: number;
  idCabeceraFlete?: number;
  numeroGuia: string;
  tipoFlete: string;
  rutaLabel: string;
  origen: string;
  destino: string;
  transportista: string;
  chofer: string;
  camion: string;
  fecha: string;
  monto: number;
  folio: string;
  estado: LifecycleStatus;
  puedeIngresar?: boolean;
  motivoNoIngreso?: string | null;
  idTipoFlete?: number | null;
  idCentroCosto?: number | null;
  idDetalleViaje?: number | null;
  idMovil?: number | null;
  idTarifa?: number | null;
  idCuentaMayor?: number | null;
  idRuta?: number | null;
  sapNumeroEntrega?: string | null;
  sapGuiaRemision?: string | null;
  guiaRemision?: string | null;
  numeroEntrega?: string | null;
  sapEmpresaTransporte?: string | null;
  sapNombreChofer?: string | null;
  sapPatente?: string | null;
  sapCarro?: string | null;
}

export function adaptCandidato(row: CandidatoRow): FleteTabla {
  return {
    kind: 'candidato',
    id: `sap-${row.id_sap_entrega}`,
    idSapEntrega: row.id_sap_entrega,
    numeroGuia: row.sap_numero_entrega ?? '-',
    tipoFlete: row.tipo_flete_nombre ?? '-',
    rutaLabel: 'Pendiente por asignar',
    origen: 'Seleccionar origen',
    destino: 'Seleccionar destino',
    transportista: row.sap_empresa_transporte ?? '-',
    chofer: row.sap_nombre_chofer ?? '-',
    camion: formatCamion(row.sap_patente, row.sap_carro),
    fecha: row.sap_fecha_salida ? formatFecha(row.sap_fecha_salida) : '-',
    monto: 0,
    folio: '-',
    estado: (row.estado as LifecycleStatus) || 'DETECTADO',
    puedeIngresar: row.puede_ingresar,
    motivoNoIngreso: row.motivo_no_ingreso,
    idTipoFlete: row.id_tipo_flete ?? null,
    idCentroCosto: row.id_centro_costo ?? null,
    sapNumeroEntrega: row.sap_numero_entrega ?? null,
    sapGuiaRemision: row.sap_guia_remision ?? null,
    numeroEntrega: row.sap_numero_entrega ?? null,
    sapEmpresaTransporte: row.sap_empresa_transporte ?? null,
    sapNombreChofer: row.sap_nombre_chofer ?? null,
    sapPatente: row.sap_patente ?? null,
    sapCarro: row.sap_carro ?? null,
  };
}

export function adaptFleteEnCurso(row: FleteEnCursoRow): FleteTabla {
  return {
    kind: 'en_curso',
    id: `cab-${row.id_cabecera_flete}`,
    idCabeceraFlete: row.id_cabecera_flete,
    idSapEntrega: row.id_sap_entrega ?? undefined,
    numeroGuia: row.numero_guia ?? '-',
    tipoFlete: row.tipo_flete_nombre ?? '-',
    rutaLabel: row.ruta_nombre ?? '-',
    origen: row.ruta_origen_nombre ?? '-',
    destino: row.ruta_destino_nombre ?? '-',
    transportista: row.movil_empresa ?? row.sap_empresa_transporte ?? '-',
    chofer: row.movil_chofer_nombre ?? row.sap_nombre_chofer ?? '-',
    camion: formatCamion(row.movil_patente ?? row.sap_patente, row.sap_carro, row.movil_tipo_camion),
    fecha: row.fecha_salida ? formatFecha(row.fecha_salida) : '-',
    monto: row.monto_aplicado ?? 0,
    folio: row.folio_numero ?? '-',
    estado: (row.estado as LifecycleStatus) || 'EN_REVISION',
    idTipoFlete: row.id_tipo_flete ?? null,
    idCentroCosto: row.id_centro_costo ?? null,
    idDetalleViaje: row.id_detalle_viaje ?? null,
    idMovil: row.id_movil ?? null,
    idTarifa: row.id_tarifa ?? null,
    idCuentaMayor: row.id_cuenta_mayor ?? null,
    idRuta: row.id_ruta ?? null,
    sapNumeroEntrega: row.sap_numero_entrega ?? null,
    sapGuiaRemision: row.sap_guia_remision ?? null,
    guiaRemision: row.guia_remision ?? null,
    numeroEntrega: row.numero_entrega ?? null,
    sapEmpresaTransporte: row.sap_empresa_transporte ?? null,
    sapNombreChofer: row.sap_nombre_chofer ?? null,
    sapPatente: row.sap_patente ?? null,
    sapCarro: row.sap_carro ?? null,
  };
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatCamion(
  patente: string | null | undefined,
  carro?: string | null,
  tipoCamion?: string | null,
): string {
  const parts = [tipoCamion ?? null, patente ?? null, carro ?? null]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
}

export type LifecycleStatus =
  | 'DETECTADO'
  | 'ACTUALIZADO'
  | 'EN_REVISION'
  | 'COMPLETADO'
  | 'ASIGNADO_FOLIO'
  | 'FACTURADO'
  | 'ANULADO';

export type UserRole = 'ingresador' | 'autorizador' | 'administrador';

export const ESTADO_LABELS: Record<LifecycleStatus, string> = {
  DETECTADO: 'Detectado',
  ACTUALIZADO: 'Actualizado',
  EN_REVISION: 'En revision',
  COMPLETADO: 'Completado',
  ASIGNADO_FOLIO: 'Asignado folio',
  FACTURADO: 'Facturado',
  ANULADO: 'Anulado',
};

export const ESTADO_BADGE: Record<LifecycleStatus, string> = {
  DETECTADO: 'badge badge-detectado',
  ACTUALIZADO: 'badge badge-actualizado',
  EN_REVISION: 'badge badge-en-revision',
  COMPLETADO: 'badge badge-completado',
  ASIGNADO_FOLIO: 'badge badge-asignado-folio',
  FACTURADO: 'badge badge-facturado',
  ANULADO: 'badge badge-anulado',
};

export const ESTADO_DOT: Record<LifecycleStatus, string> = {
  DETECTADO: 'bg-blue-500',
  ACTUALIZADO: 'bg-amber-500',
  EN_REVISION: 'bg-orange-500',
  COMPLETADO: 'bg-emerald-500',
  ASIGNADO_FOLIO: 'bg-cyan-500',
  FACTURADO: 'bg-violet-500',
  ANULADO: 'bg-slate-400',
};

export const ESTADO_HINT: Record<LifecycleStatus, string> = {
  DETECTADO: 'Encontrado en SAP. Completa la cabecera para continuar.',
  ACTUALIZADO: 'SAP reporto cambios. Revisa y confirma los datos.',
  EN_REVISION: 'Faltan campos obligatorios. Edita para completar.',
  COMPLETADO: 'Todos los datos ingresados. Listo para asignar folio.',
  ASIGNADO_FOLIO: 'Folio asignado. Pendiente de facturacion.',
  FACTURADO: 'Proceso finalizado. Flete facturado correctamente.',
  ANULADO: 'Flete anulado. No aplica en el flujo normal.',
};
