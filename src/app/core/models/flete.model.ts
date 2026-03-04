// ── Interfaces de BD (datos reales desde el backend) ──────────────────────────

/** Fila devuelta por GET /api/dashboard/fletes/no-ingresados */
export interface CandidatoRow {
  id_sap_entrega: number;
  sap_numero_entrega: string;
  estado: string;
  tipo_flete_nombre: string | null;
  ruta_nombre: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  empresa_nombre: string | null;
  chofer_nombre: string | null;
  camion_patente: string | null;
  fecha_entrega: string | null;
  monto_sap: number | null;
  puede_ingresar: boolean;
  motivo_no_ingreso: string | null;
}

/** Fila devuelta por GET /api/dashboard/fletes/completos-sin-folio */
export interface FleteEnCursoRow {
  id_cabecera_flete: number;
  folio_numero: string | null;
  estado: string;
  tipo_flete_nombre: string | null;
  ruta_nombre: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  empresa_nombre: string | null;
  chofer_nombre: string | null;
  camion_patente: string | null;
  fecha_salida: string | null;
  monto_aplicado: number | null;
  numero_guia: string | null;
  /** Snapshot de la guía de remisión SAP almacenado en cabecera */
  sap_guia_remision: string | null;
  /** Valor confirmado/editado por el operador */
  guia_remision: string | null;
  /** N° de entrega confirmado/editado por el operador */
  numero_entrega: string | null;
  /** N° de entrega SAP original almacenado en cabecera */
  sap_numero_entrega: string | null;
}

/** Unión normalizada para la tabla de la bandeja */
export interface FleteTabla {
  kind: 'candidato' | 'en_curso';
  /** Identificador único: 'sap-{id}' para candidatos, 'cab-{id}' para en_curso */
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
  /** N° de entrega SAP original (snapshot en cabecera) */
  sapNumeroEntrega?: string | null;
  /** Guía de remisión SAP (snapshot en cabecera) */
  sapGuiaRemision?: string | null;
  /** Guía de remisión confirmada/editada por el operador */
  guiaRemision?: string | null;
  /** N° de entrega confirmado/editado por el operador */
  numeroEntrega?: string | null;
}

// ── Adaptadores BD → FleteTabla ───────────────────────────────────────────────

export function adaptCandidato(row: CandidatoRow): FleteTabla {
  return {
    kind:          'candidato',
    id:            `sap-${row.id_sap_entrega}`,
    idSapEntrega:  row.id_sap_entrega,
    numeroGuia:    row.sap_numero_entrega ?? '—',
    tipoFlete:     row.tipo_flete_nombre ?? '—',
    rutaLabel:     row.ruta_nombre ?? '—',
    origen:        row.origen_nombre ?? '—',
    destino:       row.destino_nombre ?? '—',
    transportista: row.empresa_nombre ?? '—',
    chofer:        row.chofer_nombre ?? '—',
    camion:        row.camion_patente ?? '—',
    fecha:         row.fecha_entrega ? formatFecha(row.fecha_entrega) : '—',
    monto:         row.monto_sap ?? 0,
    folio:         '—',
    estado:        (row.estado as LifecycleStatus) || 'DETECTADO',
    puedeIngresar: row.puede_ingresar,
    motivoNoIngreso: row.motivo_no_ingreso,
  };
}

export function adaptFleteEnCurso(row: FleteEnCursoRow): FleteTabla {
  return {
    kind:             'en_curso',
    id:               `cab-${row.id_cabecera_flete}`,
    idCabeceraFlete:  row.id_cabecera_flete,
    numeroGuia:       row.numero_guia ?? '—',
    tipoFlete:        row.tipo_flete_nombre ?? '—',
    rutaLabel:        row.ruta_nombre ?? '—',
    origen:           row.origen_nombre ?? '—',
    destino:          row.destino_nombre ?? '—',
    transportista:    row.empresa_nombre ?? '—',
    chofer:           row.chofer_nombre ?? '—',
    camion:           row.camion_patente ?? '—',
    fecha:            row.fecha_salida ? formatFecha(row.fecha_salida) : '—',
    monto:            row.monto_aplicado ?? 0,
    folio:            row.folio_numero ?? '—',
    estado:           (row.estado as LifecycleStatus) || 'EN_REVISION',
    sapNumeroEntrega: row.sap_numero_entrega ?? null,
    sapGuiaRemision:  row.sap_guia_remision ?? null,
    guiaRemision:     row.guia_remision ?? null,
    numeroEntrega:    row.numero_entrega ?? null,
  };
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export type LifecycleStatus =
  | 'DETECTADO'
  | 'ACTUALIZADO'
  | 'EN_REVISION'
  | 'COMPLETADO'
  | 'ASIGNADO_FOLIO'
  | 'FACTURADO'
  | 'ANULADO';

export type UserRole = 'ingresador' | 'autorizador' | 'administrador';

export interface FleteItem {
  posicion: string;
  material: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  peso: number;
  especie?: string;
}

export interface Flete {
  id: string;
  guiaSap: string;
  sapId: string;
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
  observaciones?: string;
  items?: FleteItem[];
}

export interface EstadoStats {
  total: number;
  detectados: number;
  actualizados: number;
  en_revision: number;
  completados: number;
  asignados: number;
  facturados: number;
  anulados: number;
}

/* ── Human-readable labels for each state ── */
export const ESTADO_LABELS: Record<LifecycleStatus, string> = {
  DETECTADO:      'Detectado',
  ACTUALIZADO:    'Actualizado',
  EN_REVISION:    'En revisión',
  COMPLETADO:     'Completado',
  ASIGNADO_FOLIO: 'Asignado folio',
  FACTURADO:      'Facturado',
  ANULADO:        'Anulado',
};

/* ── CSS class mapping for badges ── */
export const ESTADO_BADGE: Record<LifecycleStatus, string> = {
  DETECTADO:      'badge badge-detectado',
  ACTUALIZADO:    'badge badge-actualizado',
  EN_REVISION:    'badge badge-en-revision',
  COMPLETADO:     'badge badge-completado',
  ASIGNADO_FOLIO: 'badge badge-asignado-folio',
  FACTURADO:      'badge badge-facturado',
  ANULADO:        'badge badge-anulado',
};

/* ── Dot color for each badge ── */
export const ESTADO_DOT: Record<LifecycleStatus, string> = {
  DETECTADO:      'bg-blue-500',
  ACTUALIZADO:    'bg-amber-500',
  EN_REVISION:    'bg-orange-500',
  COMPLETADO:     'bg-emerald-500',
  ASIGNADO_FOLIO: 'bg-cyan-500',
  FACTURADO:      'bg-violet-500',
  ANULADO:        'bg-slate-400',
};

/* ── Hint text for each state ── */
export const ESTADO_HINT: Record<LifecycleStatus, string> = {
  DETECTADO:      'Encontrado en SAP. Completa la cabecera para continuar.',
  ACTUALIZADO:    'SAP reportó cambios. Revisa y confirma los datos.',
  EN_REVISION:    'Faltan campos obligatorios. Edita para completar.',
  COMPLETADO:     'Todos los datos ingresados. Listo para asignar folio.',
  ASIGNADO_FOLIO: 'Folio asignado. Pendiente de facturación.',
  FACTURADO:      'Proceso finalizado. Flete facturado correctamente.',
  ANULADO:        'Flete anulado. No aplica en el flujo normal.',
};

/* ── Shared mock data used by the bandeja ── */
const TIPOS_FLETE = ['Fruta', 'Materiales', 'Interplanta', 'Mercado Nacional', 'Muestra USDA'];
const TRANSPORTISTAS = [
  'TRANSPORTES DEL VALLE S.A.',
  'FLETES VERDE LTDA.',
  'TRANSPORTES CORDILLERA S.A.',
  'LOGISTICS GREEN SPA',
  'TRANS NATURALEZA S.A.',
];
const RUTAS: { label: string; origen: string; destino: string }[] = [
  { label: 'Curicó → Santiago',       origen: 'Curicó',       destino: 'Santiago' },
  { label: 'Talca → Valparaíso',      origen: 'Talca',        destino: 'Valparaíso' },
  { label: 'Los Andes → Santiago',    origen: 'Los Andes',    destino: 'Santiago' },
  { label: 'San Fernando → Santiago', origen: 'San Fernando', destino: 'Santiago' },
  { label: 'Rancagua → Valparaíso',   origen: 'Rancagua',     destino: 'Valparaíso' },
  { label: 'Linares → Talca',         origen: 'Linares',      destino: 'Talca' },
];
const CHOFERES = [
  '12.345.678-9 — Carlos Mendoza',
  '9.876.543-2 — Jorge Silva',
  '14.567.890-K — Pedro Rojas',
  '11.223.344-5 — Manuel Vega',
  '7.654.321-1 — Andrés Fuentes',
];
const CAMIONES = [
  'Refrigerado — BCDF12',
  'Plataforma — GHIJ34',
  'Camión mayor — KLMN56',
  'Van — OPQR78',
  'Semirremolque — STUV90',
];
const ESTADOS_DIST: LifecycleStatus[] = [
  'DETECTADO', 'DETECTADO', 'DETECTADO', 'DETECTADO', 'DETECTADO',
  'ACTUALIZADO', 'ACTUALIZADO', 'ACTUALIZADO',
  'EN_REVISION', 'EN_REVISION', 'EN_REVISION', 'EN_REVISION',
  'COMPLETADO', 'COMPLETADO', 'COMPLETADO', 'COMPLETADO', 'COMPLETADO', 'COMPLETADO',
  'ASIGNADO_FOLIO', 'ASIGNADO_FOLIO', 'ASIGNADO_FOLIO', 'ASIGNADO_FOLIO', 'ASIGNADO_FOLIO',
  'FACTURADO', 'FACTURADO', 'FACTURADO',
  'ANULADO', 'ANULADO',
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export const MOCK_FLETES: Flete[] = ESTADOS_DIST.map((estado, i) => {
  const ruta       = RUTAS[i % RUTAS.length];
  const day        = (i % 28) + 1;
  const month      = (i % 6) + 1;
  const hasFormatFolio = estado === 'ASIGNADO_FOLIO' || estado === 'FACTURADO';

  return {
    id:             `CAB-${pad(i + 1)}`,
    guiaSap:        `008${String(1_234_567 + i).padStart(7, '0')}`,
    sapId:          `ENT-2025-${pad(i + 1)}`,
    tipoFlete:      TIPOS_FLETE[i % TIPOS_FLETE.length],
    rutaLabel:      ruta.label,
    origen:         ruta.origen,
    destino:        ruta.destino,
    transportista:  TRANSPORTISTAS[i % TRANSPORTISTAS.length],
    chofer:         CHOFERES[i % CHOFERES.length],
    camion:         CAMIONES[i % CAMIONES.length],
    fecha:          `${pad(day)}/${pad(month)}/2025`,
    monto:          400_000 + i * 85_000,
    folio:          hasFormatFolio ? `FOL-2025-${pad(i + 1)}` : '—',
    estado,
    observaciones:  i % 3 === 0 ? `Carga especial. Verificar temperatura en ${MESES[i % 6]}.` : '',
    items: [
      {
        posicion:   '10',
        material:   `MAT-${1000 + i}`,
        descripcion: `${TIPOS_FLETE[i % TIPOS_FLETE.length]} — lote ${String.fromCharCode(65 + (i % 8))}`,
        cantidad:   20 + (i % 10),
        unidad:     'KG',
        peso:       850 + i * 12,
        especie:    i % 2 === 0 ? 'Manzana Fuji' : 'Pera Packham',
      },
    ],
  };
});
