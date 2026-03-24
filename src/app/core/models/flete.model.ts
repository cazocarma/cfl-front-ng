import { parseLocalDate } from '../utils/format.utils';

export interface CandidatoRow {
  id_sap_entrega: number;
  sap_numero_entrega: string;
  sap_destinatario: string | null;
  id_productor?: number | null;
  productor_codigo_proveedor?: string | null;
  productor_rut?: string | null;
  productor_nombre?: string | null;
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
  id_cuenta_mayor?: number | null;
  id_imputacion_flete?: number | null;
  puede_ingresar: boolean;
  motivo_no_ingreso: string | null;
}

export interface FleteEnCursoRow {
  id_cabecera_flete: number;
  id_sap_entrega: number | null;
  id_productor?: number | null;
  productor_codigo_proveedor?: string | null;
  productor_rut?: string | null;
  productor_nombre?: string | null;
  productor_email?: string | null;
  id_tipo_flete: number | null;
  id_centro_costo: number | null;
  id_detalle_viaje: number | null;
  id_movil: number | null;
  id_tarifa: number | null;
  id_cuenta_mayor: number | null;
  id_imputacion_flete?: number | null;
  id_ruta: number | null;
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
  monto_extra: number | null;
  numero_guia: string | null;
  sap_guia_remision: string | null;
  guia_remision: string | null;
  numero_entrega: string | null;
  sap_numero_entrega: string | null;
  sap_destinatario: string | null;
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
  montoExtra: number;
  estado: LifecycleStatus;
  puedeIngresar?: boolean;
  motivoNoIngreso?: string | null;
  idTipoFlete?: number | null;
  idCentroCosto?: number | null;
  idDetalleViaje?: number | null;
  idMovil?: number | null;
  idTarifa?: number | null;
  idCuentaMayor?: number | null;
  idImputacionFlete?: number | null;
  idProductor?: number | null;
  idRuta?: number | null;
  productorCodigoProveedor?: string | null;
  productorRut?: string | null;
  productorNombre?: string | null;
  productorEmail?: string | null;
  productorLabel?: string;
  sapNumeroEntrega?: string | null;
  sapDestinatario?: string | null;
  sapGuiaRemision?: string | null;
  guiaRemision?: string | null;
  numeroEntrega?: string | null;
  sapEmpresaTransporte?: string | null;
  sapNombreChofer?: string | null;
  sapPatente?: string | null;
  sapCarro?: string | null;
}

export function adaptCandidato(row: CandidatoRow): FleteTabla {
  const productorCodigo = row.productor_codigo_proveedor ?? null;
  const productorRut = row.productor_rut ?? null;
  const productorNombre = row.productor_nombre ?? null;
  return {
    kind: 'candidato',
    id: `sap-${row.id_sap_entrega}`,
    idSapEntrega: row.id_sap_entrega,
    numeroGuia: row.sap_numero_entrega ?? '-',
    tipoFlete: row.tipo_flete_nombre ?? '-',
    rutaLabel: 'Pendiente por asignar',
    origen: '-',
    destino: '-',
    transportista: row.sap_empresa_transporte ?? '-',
    chofer: row.sap_nombre_chofer ?? '-',
    camion: formatCamion(row.sap_patente, row.sap_carro),
    fecha: row.sap_fecha_salida ? formatFecha(row.sap_fecha_salida) : '-',
    monto: 0,
    montoExtra: 0,
    estado: (row.estado as LifecycleStatus) || 'DETECTADO',
    puedeIngresar: row.puede_ingresar,
    motivoNoIngreso: row.motivo_no_ingreso,
    idProductor: row.id_productor ?? null,
    idTipoFlete: row.id_tipo_flete ?? null,
    idCentroCosto: row.id_centro_costo ?? null,
    idCuentaMayor: row.id_cuenta_mayor ?? null,
    idImputacionFlete: row.id_imputacion_flete ?? null,
    productorCodigoProveedor: productorCodigo,
    productorRut,
    productorNombre,
    productorLabel: formatProductorLabel(productorCodigo, productorRut, productorNombre, row.sap_destinatario),
    sapNumeroEntrega: row.sap_numero_entrega ?? null,
    sapDestinatario: row.sap_destinatario ?? null,
    sapGuiaRemision: row.sap_guia_remision ?? null,
    numeroEntrega: row.sap_numero_entrega ?? null,
    sapEmpresaTransporte: row.sap_empresa_transporte ?? null,
    sapNombreChofer: row.sap_nombre_chofer ?? null,
    sapPatente: row.sap_patente ?? null,
    sapCarro: row.sap_carro ?? null,
  };
}

export function adaptFleteEnCurso(row: FleteEnCursoRow): FleteTabla {
  const productorCodigo = row.productor_codigo_proveedor ?? null;
  const productorRut = row.productor_rut ?? null;
  const productorNombre = row.productor_nombre ?? null;
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
    montoExtra: row.monto_extra ?? 0,
    estado: (row.estado as LifecycleStatus) || 'EN_REVISION',
    idTipoFlete: row.id_tipo_flete ?? null,
    idCentroCosto: row.id_centro_costo ?? null,
    idDetalleViaje: row.id_detalle_viaje ?? null,
    idMovil: row.id_movil ?? null,
    idTarifa: row.id_tarifa ?? null,
    idCuentaMayor: row.id_cuenta_mayor ?? null,
    idImputacionFlete: row.id_imputacion_flete ?? null,
    idProductor: row.id_productor ?? null,
    idRuta: row.id_ruta ?? null,
    productorCodigoProveedor: productorCodigo,
    productorRut,
    productorNombre,
    productorEmail: row.productor_email ?? null,
    productorLabel: formatProductorLabel(productorCodigo, productorRut, productorNombre, row.sap_destinatario),
    sapNumeroEntrega: row.sap_numero_entrega ?? null,
    sapDestinatario: row.sap_destinatario ?? null,
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
  const d = parseLocalDate(iso);
  if (!d) return iso;
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

function formatProductorLabel(
  codigo: string | null | undefined,
  rut: string | null | undefined,
  nombre: string | null | undefined,
  sapDestinatario: string | null | undefined,
): string {
  const codigoTrim = String(codigo ?? '').trim();
  const rutTrim = String(rut ?? '').trim();
  const nombreTrim = String(nombre ?? '').trim();
  if (codigoTrim && nombreTrim) return `${codigoTrim} - ${nombreTrim}`;
  if (rutTrim && nombreTrim) return `${rutTrim} - ${nombreTrim}`;
  if (nombreTrim) return nombreTrim;
  if (codigoTrim) return codigoTrim;
  if (rutTrim) return rutTrim;
  return String(sapDestinatario ?? '').trim() || '-';
}

export type LifecycleStatus =
  | 'DETECTADO'
  | 'ACTUALIZADO'
  | 'EN_REVISION'
  | 'COMPLETADO'
  | 'PREFACTURADO'
  | 'FACTURADO'
  | 'ANULADO';

export type UserRole = 'ingresador' | 'autorizador' | 'administrador';

export const ESTADO_LABELS: Record<LifecycleStatus, string> = {
  DETECTADO: 'Detectado',
  ACTUALIZADO: 'Actualizado',
  EN_REVISION: 'En revision',
  COMPLETADO: 'Completado',
  PREFACTURADO: 'Pre facturado',
  FACTURADO: 'Facturado',
  ANULADO: 'Anulado',
};

export const ESTADO_BADGE: Record<LifecycleStatus, string> = {
  DETECTADO: 'badge badge-detectado',
  ACTUALIZADO: 'badge badge-actualizado',
  EN_REVISION: 'badge badge-en-revision',
  COMPLETADO: 'badge badge-completado',
  PREFACTURADO: 'badge badge-prefacturado',
  FACTURADO: 'badge badge-facturado',
  ANULADO: 'badge badge-anulado',
};

export const ESTADO_DOT: Record<LifecycleStatus, string> = {
  DETECTADO: 'bg-blue-500',
  ACTUALIZADO: 'bg-amber-500',
  EN_REVISION: 'bg-orange-500',
  COMPLETADO: 'bg-emerald-500',
  PREFACTURADO: 'bg-cyan-500',
  FACTURADO: 'bg-violet-500',
  ANULADO: 'bg-slate-400',
};

export const ESTADO_HINT: Record<LifecycleStatus, string> = {
  DETECTADO: 'Encontrado en SAP. Completa la cabecera para continuar.',
  ACTUALIZADO: 'SAP reporto cambios. Revisa y confirma los datos.',
  EN_REVISION: 'Faltan campos obligatorios. Edita para completar.',
  COMPLETADO: 'Todos los datos ingresados. Listo para pre facturar.',
  PREFACTURADO: 'Incluido en pre factura',
  FACTURADO: 'Proceso finalizado. Flete pre facturado correctamente.',
  ANULADO: 'Flete anulado. No aplica en el flujo normal.',
};
