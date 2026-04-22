// ────────────────────────────────────────────────────────────────────
// Estado de intención del modal de flete para cada entidad de
// transporte (empresa, chofer, camión). Describe qué hará el backend
// al guardar el flete: nada, update, pending_create o empty.
//
// Maneja también el caso especial de cambio de tipo-camión sobre un
// camión existente (requiere confirmación explícita del usuario).
// ────────────────────────────────────────────────────────────────────

export type EntityResolutionMode = 'matched' | 'pending_create' | 'update' | 'empty';

export interface EmpresaTransporteDraft {
  sap_codigo: string | null;
  rut: string | null;
  razon_social: string | null;
  nombre_representante: string | null;
  correo: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface ChoferDraft {
  sap_id_fiscal: string | null;
  sap_nombre: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface CamionDraft {
  sap_patente: string | null;
  sap_carro: string | null;
  id_tipo_camion: number | null;
  activo: boolean;
}

export interface EntityResolution<TDraft> {
  mode: EntityResolutionMode;
  /** Cuando mode='matched' | 'update', id del registro existente. */
  existingId: number | null;
  /** Forma editable; poblada desde SAP/Romana o del registro existente. */
  draft: TDraft;
  /** Snapshot para detectar dirty vs draft actual. */
  pristine: TDraft;
  /** Texto SAP/Romana original que gatilló el pending; meramente UX. */
  hint: string;
}

export interface TipoCamionChangePlan {
  /** El usuario cambió el IdTipoCamion del camión seleccionado. */
  changed: boolean;
  originalIdTipoCamion: number | null;
  newIdTipoCamion: number | null;
  /** Checkbox confirmado por el usuario. Sin true, el cambio NO se aplica. */
  confirmed: boolean;
}

export interface TransportIntent {
  empresa: EntityResolution<EmpresaTransporteDraft>;
  chofer: EntityResolution<ChoferDraft>;
  camion: EntityResolution<CamionDraft>;
  camionTipoChange: TipoCamionChangePlan;
  /** Si true, el backend recalcula tarifa tras resolver entidades. */
  recalcTarifa: boolean;
  /** Contexto de ruta para el recálculo. */
  routeContext: {
    idRuta: number | null;
    fechaSalida: string | null;
  };
}

export function emptyEmpresaDraft(): EmpresaTransporteDraft {
  return {
    sap_codigo: null,
    rut: null,
    razon_social: null,
    nombre_representante: null,
    correo: null,
    telefono: null,
    activo: true,
  };
}

export function emptyChoferDraft(): ChoferDraft {
  return {
    sap_id_fiscal: null,
    sap_nombre: null,
    telefono: null,
    activo: true,
  };
}

export function emptyCamionDraft(): CamionDraft {
  return {
    sap_patente: null,
    sap_carro: null,
    id_tipo_camion: null,
    activo: true,
  };
}

export function initialTransportIntent(): TransportIntent {
  return {
    empresa: { mode: 'empty', existingId: null, draft: emptyEmpresaDraft(), pristine: emptyEmpresaDraft(), hint: '' },
    chofer: { mode: 'empty', existingId: null, draft: emptyChoferDraft(), pristine: emptyChoferDraft(), hint: '' },
    camion: { mode: 'empty', existingId: null, draft: emptyCamionDraft(), pristine: emptyCamionDraft(), hint: '' },
    camionTipoChange: { changed: false, originalIdTipoCamion: null, newIdTipoCamion: null, confirmed: false },
    recalcTarifa: false,
    routeContext: { idRuta: null, fechaSalida: null },
  };
}

/** Detecta si el draft difiere de pristine (shallow compare). */
export function isDraftDirty<T extends object>(draft: T, pristine: T): boolean {
  const draftRec = draft as unknown as Record<string, unknown>;
  const pristineRec = pristine as unknown as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(draftRec), ...Object.keys(pristineRec)]);
  for (const key of keys) {
    const a = draftRec[key];
    const b = pristineRec[key];
    if ((a ?? null) !== (b ?? null)) return true;
  }
  return false;
}

/** Calcula diff (fields cambiados de draft vs pristine). */
export function computeDraftDiff<T extends object>(draft: T, pristine: T): Partial<T> {
  const diff: Partial<T> = {};
  const draftRec = draft as unknown as Record<string, unknown>;
  const pristineRec = pristine as unknown as Record<string, unknown>;
  const diffRec = diff as unknown as Record<string, unknown>;
  const keys = new Set<string>([...Object.keys(draftRec), ...Object.keys(pristineRec)]);
  for (const key of keys) {
    const a = draftRec[key];
    const b = pristineRec[key];
    if ((a ?? null) !== (b ?? null)) {
      diffRec[key] = a;
    }
  }
  return diff;
}
