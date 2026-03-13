import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, forkJoin, of, retry } from 'rxjs';

import { CflApiService } from '../../core/services/cfl-api.service';
import { FleteTabla } from '../../core/models/flete.model';
import {
  SearchableComboboxComponent,
  SearchableOption,
} from './searchable-combobox.component';

type ModalTab = 'cabecera' | 'detalles';
export type ModalMode = 'edit' | 'view';

interface DetalleDraft {
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

interface DetalleGrupo {
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

interface DashboardDetalleResponse {
  data?: {
    cabecera?: Record<string, unknown>;
    posiciones?: Record<string, unknown>[];
  };
}

interface FleteDetalleResponse {
  data?: {
    cabecera?: Record<string, unknown>;
    detalles?: Record<string, unknown>[];
  };
}

interface TarifaListResponse {
  data?: unknown[];
  temporada_id?: number | null;
}

interface CatalogCacheSnapshot {
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

@Component({
    selector: 'app-edit-flete-modal',
    imports: [ReactiveFormsModule, SearchableComboboxComponent],
    templateUrl: './edit-flete-modal.component.html',
    styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5;
    }

    .detail-chip {
      @apply inline-flex items-center rounded-full border border-forest-200 bg-white px-2.5 py-1 text-[11px] font-medium text-forest-700;
    }

    .route-node {
      @apply min-w-[120px] rounded-xl border border-forest-200 bg-white px-3 py-2 text-center text-xs font-semibold text-forest-800 shadow-sm;
    }
  `]
})
export class EditFleteModalComponent implements OnChanges {
  private static readonly CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
  private static catalogCache: CatalogCacheSnapshot | null = null;
  private contextVersion = 0;

  @Input() flete: FleteTabla | null = null;
  @Input() visible = false;
  @Input() mode: ModalMode = 'edit';
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado = new EventEmitter<void>();

  form: FormGroup;
  activeTab = signal<ModalTab>('cabecera');
  loadingCatalogos = signal(false);
  detailLoading = signal(false);
  saving = signal(false);
  errorMsg = signal('');
  detailError = signal('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tiposFlete: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tiposCamion: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  centrosCosto: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detallesViaje: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodos: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rutas: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tarifas: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empresas: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  choferes: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  camiones: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cuentasMayor: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imputacionesFlete: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  especies: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productores: any[] = [];

  tipoFleteOptions: SearchableOption[] = [];
  tipoCamionOptions: SearchableOption[] = [];
  centroCostoOptions: SearchableOption[] = [];
  detalleViajeOptions: SearchableOption[] = [];
  nodoOptions: SearchableOption[] = [];
  origenNodoOptions: SearchableOption[] = [];
  destinoNodoOptions: SearchableOption[] = [];
  empresaOptions: SearchableOption[] = [];
  choferOptions: SearchableOption[] = [];
  camionOptions: SearchableOption[] = [];
  cuentaMayorOptions: SearchableOption[] = [];
  especieOptions: SearchableOption[] = [];
  productorOptions: SearchableOption[] = [];
  destinoHintLabel = 'Selecciona un origen para filtrar los destinos con tarifa vigente.';

  detailRows = signal<DetalleDraft[]>([]);

  /** Vista agrupada por material (o por rowId si no hay material). */
  readonly groupedRows = computed<DetalleGrupo[]>(() => {
    const rows = this.detailRows();
    const groups = new Map<string, DetalleGrupo>();
    for (const row of rows) {
      const mat = row.material.trim().toUpperCase();
      const key = mat || row.rowId;
      if (!groups.has(key)) {
        groups.set(key, {
          materialKey: key,
          material: row.material,
          descripcion: row.descripcion,
          cantidad_total: Number(row.cantidad) || 0,
          peso_total: Number(row.peso) || 0,
          unidad: row.unidad,
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
  });

  sapSnapshot: Record<string, unknown> | null = null;
  currentTemporadaId: number | null = null;
  currentTemporadaLabel = '';
  resolvedRouteName = '';
  resolvedRouteDistanceKm: number | null = null;
  resolvedRouteMonto: number | null = null;
  resolvedRouteMoneda = '';
  routeResolutionHint = 'Selecciona origen y destino para resolver la ruta.';
  private imputacionesByTipo = new Map<string, Record<string, unknown>[]>();
  private imputacionesById = new Map<string, Record<string, unknown>>();

  readonly tipoMovimientoOptions: SearchableOption[] = [
    { value: 'PUSH', label: 'Despacho' },
    { value: 'PULL', label: 'Retorno' },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(private fb: FormBuilder, private cflApi: CflApiService) {
    this.form = this.fb.group({
      numero_entrega: [''],
      guia_remision: ['', Validators.required],
      tipo_movimiento: ['', Validators.required],
      id_tipo_flete: ['', Validators.required],
      id_tipo_camion: [''],
      id_imputacion_flete: [''],
      id_centro_costo: ['', Validators.required],
      id_detalle_viaje: [''],
      id_origen_nodo: [''],
      id_destino_nodo: [''],
      id_ruta: [''],
      id_tarifa: [''],
      fecha_salida: ['', Validators.required],
      hora_salida: ['', Validators.required],
      id_empresa_transporte: [''],
      id_chofer: [''],
      id_camion: [''],
      id_productor: [''],
      monto_aplicado: [null],
      id_cuenta_mayor: [''],
      observaciones: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const opened = changes['visible']?.currentValue === true;
    const fleteChangedWhileVisible = this.visible && !!changes['flete'] && !opened;

    if (opened || fleteChangedWhileVisible) {
      this._initializeModalState();
      return;
    }

    if (changes['mode'] && this.visible) {
      this._applyFormMode();
    }
  }

  isReadOnly(): boolean {
    return this.mode === 'view';
  }

  getModalTitle(): string {
    if (this.isReadOnly()) {
      if (!this.flete) return 'Ver flete manual';
      if (this.flete.kind === 'candidato') return `Ver candidato SAP #${this.flete.numeroGuia}`;
      return `Ver flete #${this.flete.numeroGuia}`;
    }

    if (!this.flete) return 'Ingreso manual de flete';
    if (this.flete.kind === 'candidato') return `Crear flete desde SAP #${this.flete.numeroGuia}`;
    return `Editar flete #${this.flete.numeroGuia}`;
  }

  getModalSubtitle(): string {
    return this.isReadOnly()
      ? 'Informacion en modo solo lectura'
      : 'Completa la cabecera y revisa los detalles';
  }

  showSapSnapshot(): boolean {
    return this.isSapBacked();
  }

  isSapBacked(): boolean {
    return Boolean(this.flete?.kind === 'candidato' || this.getSapNumeroEntrega());
  }

  canManageDetailRows(): boolean {
    return !this.isReadOnly() && !this.isSapBacked();
  }

  hasResolvedRoute(): boolean {
    return Boolean(this.resolvedRouteName);
  }

  hasResolvedMonto(): boolean {
    return this.resolvedRouteMonto !== null;
  }

  getSapNumeroEntrega(): string {
    return this._toString(this.sapSnapshot?.['sap_numero_entrega']) || this._toString(this.flete?.sapNumeroEntrega) || '';
  }

  getSapGuiaRemision(): string {
    return this._toString(this.sapSnapshot?.['sap_guia_remision']) || this._toString(this.flete?.sapGuiaRemision) || '';
  }

  getSapDestinatario(): string {
    return this._toString(this.sapSnapshot?.['sap_destinatario']) || this._toString(this.flete?.sapDestinatario) || '';
  }

  getCurrentTemporadaLabel(): string {
    return this.currentTemporadaLabel || 'Sin temporada activa';
  }

  getRouteAmountLabel(): string {
    if (this.resolvedRouteMonto === null) return 'Sin tarifa vigente';
    const formatter = new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const prefix = this.resolvedRouteMoneda ? `${this.resolvedRouteMoneda} ` : '';
    return `${prefix}${formatter.format(this.resolvedRouteMonto)}`;
  }

  getRouteOriginLabel(): string {
    return this._findNodoLabel(this.getControlValue('id_origen_nodo')) || 'Origen';
  }

  getRouteDestinationLabel(): string {
    return this._findNodoLabel(this.getControlValue('id_destino_nodo')) || 'Destino';
  }

  isInvalid(key: string): boolean {
    const ctrl = this.form.get(key);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  getControlValue(key: string): string {
    return this._toControlValue(this.form.get(key)?.value);
  }

  setControlValue(key: string, value: string): void {
    if (this.isReadOnly()) return;
    const previousValue = this.getControlValue(key);
    this.form.get(key)?.setValue(value);

    if (key === 'id_tipo_flete' && value !== previousValue) {
      this.form.patchValue(
        {
          id_imputacion_flete: '',
          id_centro_costo: '',
          id_cuenta_mayor: '',
        },
        { emitEvent: false }
      );
    }

    if (key === 'id_centro_costo' && value !== previousValue) {
      this.form.patchValue(
        {
          id_imputacion_flete: '',
          id_cuenta_mayor: '',
        },
        { emitEvent: false }
      );
    }

    if (key === 'id_imputacion_flete') {
      this._applyImputacionSelection(value);
    }

    if (key === 'id_tipo_flete' || key === 'id_centro_costo' || key === 'id_cuenta_mayor') {
      this._syncImputacionFromFields();
    }

    if (key === 'id_tipo_camion' && value !== previousValue) {
      const selectedCamionId = this.getControlValue('id_camion');
      if (selectedCamionId) {
        const selectedCamion = this.camiones.find((row) => String(row['id_camion']) === selectedCamionId) || null;
        const selectedCamionTipo = this._toControlValue(selectedCamion?.['id_tipo_camion']);
        if (selectedCamionTipo && selectedCamionTipo !== value) {
          this.form.patchValue({ id_camion: '' }, { emitEvent: false });
        }
      }
    }

    if (key === 'id_camion') {
      this._syncTipoCamionFromCamion(value);
    }

    if (key === 'id_camion' || key === 'id_tipo_camion' || key === 'fecha_salida') {
      this._refreshRouteNodeFilters(false);
      this._syncRouteAndTarifa(true);
    }
  }

  getTipoFleteOptions(): SearchableOption[] {
    return this.tipoFleteOptions;
  }

  getTipoCamionOptions(): SearchableOption[] {
    return this.tipoCamionOptions;
  }

  getCentroCostoOptions(): SearchableOption[] {
    const tipoId = this.getControlValue('id_tipo_flete');
    if (!tipoId) return [];

    const imputaciones = this._getImputacionesByTipo(tipoId);
    if (imputaciones.length === 0) return [];

    const allowedCentro = new Set(imputaciones.map((row) => String(row['id_centro_costo'])));
    return this.centroCostoOptions.filter((opt) => allowedCentro.has(opt.value));
  }

  getDetalleViajeOptions(): SearchableOption[] {
    return this.detalleViajeOptions;
  }

  setRouteNodeValue(key: 'id_origen_nodo' | 'id_destino_nodo', value: string): void {
    if (this.isReadOnly()) return;
    const previousValue = this.getControlValue(key);
    this.form.get(key)?.setValue(value);
    if (key === 'id_origen_nodo') {
      this._refreshRouteNodeFilters(value !== previousValue);
    } else {
      this._refreshRouteNodeFilters(false);
    }
    this._syncRouteAndTarifa(true);
  }

  getOrigenNodoOptions(): SearchableOption[] {
    return this.origenNodoOptions;
  }

  getDestinoNodoOptions(): SearchableOption[] {
    return this.destinoNodoOptions;
  }

  getDestinoHint(): string {
    return this.destinoHintLabel;
  }

  getNodoOptions(): SearchableOption[] {
    return this.nodoOptions;
  }

  getEmpresaOptions(): SearchableOption[] {
    return this.empresaOptions;
  }

  getChoferOptions(): SearchableOption[] {
    return this.choferOptions;
  }

  getCamionOptions(): SearchableOption[] {
    const selectedTipoCamion = this.getControlValue('id_tipo_camion');
    if (!selectedTipoCamion) return this.camionOptions;

    const allowedCamion = new Set(
      this.camiones
        .filter((row) => this._toControlValue(row['id_tipo_camion']) === selectedTipoCamion)
        .map((row) => this._toControlValue(row['id_camion']))
        .filter((id) => Boolean(id))
    );

    const selectedCamion = this.getControlValue('id_camion');
    return this.camionOptions.filter((opt) => allowedCamion.has(opt.value) || opt.value === selectedCamion);
  }

  getCamionHint(): string {
    const selectedTipoCamion = this.getControlValue('id_tipo_camion');
    if (!selectedTipoCamion) return 'Selecciona tipo de camion para acotar opciones.';
    const total = this.getCamionOptions().length;
    return total > 0
      ? `Mostrando ${total} camion(es) del tipo seleccionado.`
      : 'No hay camiones activos para el tipo seleccionado.';
  }

  isCentroCostoDisabled(): boolean {
    return this.isReadOnly() || !this.getControlValue('id_tipo_flete');
  }

  isCuentaMayorDisabled(): boolean {
    return this.isReadOnly() || !this.getControlValue('id_tipo_flete') || !this.getControlValue('id_centro_costo');
  }

  hasImputacionResuelta(): boolean {
    return Boolean(this.getControlValue('id_imputacion_flete'));
  }

  getImputacionHintLabel(): string {
    const idImputacion = this.getControlValue('id_imputacion_flete');
    if (!idImputacion) {
      return 'Se resolvera automaticamente al definir tipo de flete, centro de costo y cuenta mayor.';
    }

    const imputacion = this._findImputacionById(idImputacion);
    if (!imputacion) {
      return 'Imputacion automatica aplicada por reglas activas.';
    }

    const tipo = this._toString(imputacion['tipo_flete_nombre']) || this._toString(imputacion['tipo_flete_sap_codigo']) || 'Tipo';
    const centro = this._toString(imputacion['centro_costo_sap_codigo']) || this._toString(imputacion['centro_costo_nombre']) || 'Centro';
    const cuenta = this._toString(imputacion['cuenta_mayor_codigo']) || this._toString(imputacion['cuenta_mayor_glosa']) || 'Cuenta';
    return `Regla aplicada: ${tipo} | ${centro} | ${cuenta}`;
  }

  getCuentaMayorOptions(): SearchableOption[] {
    const tipoId = this.getControlValue('id_tipo_flete');
    if (!tipoId) return [];

    const centroId = this.getControlValue('id_centro_costo');
    if (!centroId) return [];

    let imputaciones = this._getImputacionesByTipo(tipoId);
    imputaciones = imputaciones.filter((row) => String(row['id_centro_costo']) === centroId);
    if (imputaciones.length === 0) return [];

    const allowedCuenta = new Set(imputaciones.map((row) => String(row['id_cuenta_mayor'])));
    return this.cuentaMayorOptions.filter((opt) => allowedCuenta.has(opt.value));
  }

  getProductorOptions(): SearchableOption[] {
    return this.productorOptions;
  }

  getSelectedProductor(): Record<string, unknown> | null {
    const idProductor = this.getControlValue('id_productor');
    if (!idProductor) return null;
    return this.productores.find((row) => String(row['id_productor']) === idProductor) || null;
  }

  getEspecieOptions(): SearchableOption[] {
    return this.especieOptions;
  }

  getDetalleEspecieValue(row: DetalleDraft): string {
    return row.id_especie;
  }

  setDetalleEspecieValue(rowId: string, value: string): void {
    if (this.isReadOnly()) return;
    this._updateDetailRow(rowId, { id_especie: value });
  }

  addDetailRow(): void {
    if (this.isReadOnly()) return;
    this.detailRows.update((rows) => [...rows, this._createEmptyDetailRow()]);
  }

  removeDetailRow(rowId: string): void {
    if (this.isReadOnly()) return;
    this.detailRows.update((rows) => rows.filter((row) => row.rowId !== rowId));
  }

  updateDetailField(rowId: string, field: keyof DetalleDraft, value: string): void {
    if (this.isReadOnly()) return;
    this._updateDetailRow(rowId, { [field]: value } as Partial<DetalleDraft>);
  }

  // --- Group-level edits ------------------------------------------------

  /** Actualiza la especie de TODOS los detalles del grupo (SAP y manual). */
  updateGroupEspecie(materialKey: string, value: string): void {
    if (this.isReadOnly()) return;
    this.detailRows.update(rows => rows.map(row => {
      const k = row.material.trim().toUpperCase() || row.rowId;
      return k === materialKey ? { ...row, id_especie: value } : row;
    }));
  }

  /**
   * Actualiza un campo de todos los detalles del grupo (solo fletes manuales).
   * Si el grupo tiene más de una fila, consolida a la primera y elimina el resto.
   */
  updateGroupField(materialKey: string, field: 'material' | 'descripcion' | 'cantidad' | 'unidad' | 'peso', value: string): void {
    if (this.isReadOnly() || this.isSapBacked()) return;
    this.detailRows.update(rows => {
      const groupIds = rows
        .filter(r => (r.material.trim().toUpperCase() || r.rowId) === materialKey)
        .map(r => r.rowId);

      if (groupIds.length <= 1) {
        return rows.map(row => {
          const k = row.material.trim().toUpperCase() || row.rowId;
          return k === materialKey ? { ...row, [field]: value } : row;
        });
      }
      // Grupo con múltiples filas: consolidar en la primera, eliminar el resto
      const firstId = groupIds[0];
      return rows
        .filter(r => r.rowId === firstId || (r.material.trim().toUpperCase() || r.rowId) !== materialKey)
        .map(row => row.rowId === firstId ? { ...row, [field]: value } : row);
    });
  }

  /** Elimina todos los detalles del grupo (solo fletes manuales). */
  removeDetailGroup(materialKey: string): void {
    if (this.isReadOnly()) return;
    this.detailRows.update(rows => rows.filter(row =>
      (row.material.trim().toUpperCase() || row.rowId) !== materialKey
    ));
  }

  /** Formatea un número para mostrar en plantilla. */
  formatNum(value: number, decimals: number): string {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) {
      return;
    }
  }

  onGuardar(): void {
    if (this.isReadOnly()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set('cabecera');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');

    const payload = this._buildPayload();
    let obs$: Observable<unknown>;

    if (this.flete?.kind === 'candidato' && this.flete.idSapEntrega) {
      obs$ = this.cflApi.crearCabeceraDesdeCandidato(this.flete.idSapEntrega, payload);
    } else if (this.flete?.kind === 'en_curso' && this.flete.idCabeceraFlete) {
      obs$ = this.cflApi.updateFleteById(this.flete.idCabeceraFlete, payload);
    } else {
      obs$ = this.cflApi.crearFleteManual(payload);
    }

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.guardado.emit();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al guardar el flete.');
        this.saving.set(false);
      },
    });
  }

  private _resetState(): void {
    this.contextVersion += 1;
    this.errorMsg.set('');
    this.detailError.set('');
    this.activeTab.set('cabecera');
    this.sapSnapshot = null;
    this.detailRows.set([]);
    this.origenNodoOptions = [];
    this.destinoNodoOptions = [];
    this.destinoHintLabel = 'Selecciona un origen para filtrar los destinos con tarifa vigente.';
    this.currentTemporadaId = null;
    this.currentTemporadaLabel = '';
    this.resolvedRouteName = '';
    this.resolvedRouteDistanceKm = null;
    this.resolvedRouteMonto = null;
    this.resolvedRouteMoneda = '';
    this.routeResolutionHint = 'Selecciona origen y destino para resolver la ruta.';
  }

  private _initializeModalState(): void {
    this._resetState();
    this._seedBaseForm();
    this._applyFormMode();
    this._loadCatalogos();
  }

  private _applyFormMode(): void {
    if (this.isReadOnly()) {
      this.form.disable({ emitEvent: false });
      return;
    }
    this.form.enable({ emitEvent: false });
  }

  private _seedBaseForm(): void {
    const now = new Date();
    this.form.reset({
      numero_entrega: this.flete?.numeroEntrega ?? '',
      guia_remision: this.flete?.guiaRemision ?? '',
      tipo_movimiento: 'PUSH',
      id_tipo_flete: this._toControlValue(this.flete?.idTipoFlete),
      id_tipo_camion: '',
      id_imputacion_flete: this._toControlValue(this.flete?.idImputacionFlete),
      id_centro_costo: this._toControlValue(this.flete?.idCentroCosto),
      id_detalle_viaje: this._toControlValue(this.flete?.idDetalleViaje),
      id_origen_nodo: '',
      id_destino_nodo: '',
      id_ruta: this._toControlValue(this.flete?.idRuta),
      id_tarifa: this._toControlValue(this.flete?.idTarifa),
      fecha_salida: this._formatDate(now),
      hora_salida: this._formatTime(now),
      id_empresa_transporte: '',
      id_chofer: '',
      id_camion: '',
      id_productor: this._toControlValue(this.flete?.idProductor),
      monto_aplicado: this.flete?.monto ?? null,
      id_cuenta_mayor: this._toControlValue(this.flete?.idCuentaMayor),
      observaciones: '',
    });
  }

  private _loadCatalogos(): void {
    const cached = EditFleteModalComponent.catalogCache;
    if (cached && (Date.now() - cached.loadedAt) < EditFleteModalComponent.CATALOG_CACHE_TTL_MS) {
      this._applyCatalogSnapshot(cached);
      this._applyFallbacks(true);
      this._loadFleteContext();
      if ((cached.productores?.length || 0) === 0) {
        this._loadProductoresDeferred();
      }
      return;
    }

    this.loadingCatalogos.set(true);
    forkJoin({
      tiposFlete: this._safeCatalog('tipos-flete'),
      tiposCamion: this._safeCatalog('tipos-camion'),
      centrosCosto: this._safeCatalog('centros-costo'),
      detallesViaje: this._safeCatalog('detalles-viaje'),
      nodos: this._safeCatalog('nodos'),
      rutas: this._safeCatalog('rutas'),
      tarifas: this._safeTarifas(),
      empresas: this._safeCatalog('empresas-transporte'),
      choferes: this._safeCatalog('choferes'),
      camiones: this._safeCatalog('camiones'),
      cuentasMayor: this._safeCatalog('cuentas-mayor'),
      imputacionesFlete: this._safeCatalog('imputaciones-flete'),
      especies: this._safeCatalog('especies'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.tiposFlete = res.tiposFlete.data as Record<string, unknown>[];
        this.tiposCamion = res.tiposCamion.data as Record<string, unknown>[];
        this.centrosCosto = res.centrosCosto.data as Record<string, unknown>[];
        this.detallesViaje = res.detallesViaje.data as Record<string, unknown>[];
        this.nodos = res.nodos.data as Record<string, unknown>[];
        this.rutas = res.rutas.data as Record<string, unknown>[];
        this.tarifas = res.tarifas.data as Record<string, unknown>[];
        this.empresas = res.empresas.data as Record<string, unknown>[];
        this.choferes = res.choferes.data as Record<string, unknown>[];
        this.camiones = res.camiones.data as Record<string, unknown>[];
        this.productores = [];
        this.cuentasMayor = res.cuentasMayor.data as Record<string, unknown>[];
        this.imputacionesFlete = res.imputacionesFlete.data as Record<string, unknown>[];
        this.especies = res.especies.data as Record<string, unknown>[];
        this.currentTemporadaId = res.tarifas.temporada_id ?? null;
        this.currentTemporadaLabel = this._toString(this.tarifas[0]?.['temporada_nombre']) || this._toString(this.tarifas[0]?.['temporada_codigo']) || '';
        this.tipoFleteOptions = this._mapOptions(this.tiposFlete, 'id_tipo_flete', ['nombre', 'sap_codigo']);
        this.tipoCamionOptions = this._mapOptions(this.tiposCamion, 'id_tipo_camion', ['nombre', 'categoria']);
        this.centroCostoOptions = this._mapOptions(this.centrosCosto, 'id_centro_costo', ['sap_codigo', 'nombre']);
        this.detalleViajeOptions = this._mapOptions(this.detallesViaje, 'id_detalle_viaje', ['descripcion']);
        this.nodoOptions = this._mapOptions(this.nodos, 'id_nodo', ['nombre']);
        this.empresaOptions = this._mapOptions(this.empresas, 'id_empresa', ['sap_codigo', 'razon_social']);
        this.choferOptions = this._mapOptions(this.choferes, 'id_chofer', ['sap_nombre', 'sap_id_fiscal']);
        this.camionOptions = this._mapOptions(this.camiones, 'id_camion', ['sap_patente', 'sap_carro']);
        this.productorOptions = [];
        this.cuentaMayorOptions = this._mapOptions(this.cuentasMayor, 'id_cuenta_mayor', ['codigo', 'glosa']);
        this._rebuildImputacionIndexes();
        this.especieOptions = this._mapOptions(this.especies, 'id_especie', ['glosa']);

        EditFleteModalComponent.catalogCache = {
          loadedAt: Date.now(),
          tiposFlete: this.tiposFlete,
          tiposCamion: this.tiposCamion,
          centrosCosto: this.centrosCosto,
          detallesViaje: this.detallesViaje,
          nodos: this.nodos,
          rutas: this.rutas,
          tarifas: this.tarifas,
          empresas: this.empresas,
          choferes: this.choferes,
          camiones: this.camiones,
          cuentasMayor: this.cuentasMayor,
          imputacionesFlete: this.imputacionesFlete,
          especies: this.especies,
          productores: [],
          temporadaId: this.currentTemporadaId,
          temporadaLabel: this.currentTemporadaLabel,
        };

        this._applyFallbacks(true);
        this.loadingCatalogos.set(false);
        this._loadFleteContext();
        this._loadProductoresDeferred();
      },
      error: () => {
        this.errorMsg.set('Error cargando catalogos. Intenta nuevamente.');
        this.loadingCatalogos.set(false);
        this._loadFleteContext();
      },
    });
  }

  private _loadFleteContext(): void {
    const contextVersion = this.contextVersion;

    if (this.flete?.kind === 'candidato' && this.flete.idSapEntrega) {
      this.detailLoading.set(true);
      this.cflApi.getMissingFleteDetalle(this.flete.idSapEntrega).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          if (!this._isCurrentContext(contextVersion)) return;
          this._hydrateCandidate(res as DashboardDetalleResponse);
          this.detailLoading.set(false);
        },
        error: (err) => {
          if (!this._isCurrentContext(contextVersion)) return;
          this.detailError.set(err?.error?.error ?? 'No se pudieron cargar las posiciones SAP.');
          this.detailLoading.set(false);
        },
      });
      return;
    }

    if (this.flete?.kind === 'en_curso' && this.flete.idCabeceraFlete) {
      this.detailLoading.set(true);
      this.cflApi.getFleteById(this.flete.idCabeceraFlete).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          if (!this._isCurrentContext(contextVersion)) return;
          this._hydrateExisting(res as FleteDetalleResponse);
          this.detailLoading.set(false);
        },
        error: (err) => {
          if (!this._isCurrentContext(contextVersion)) return;
          const message = err?.error?.error ?? 'No se pudo cargar el detalle del flete.';
          this.errorMsg.set(message);
          this.detailError.set(message);
          this.detailLoading.set(false);
        },
      });
      return;
    }

    this.detailLoading.set(false);
  }

  private _safeCatalog(entity: string): Observable<{ data: unknown[] }> {
    return this.cflApi.listMaintainerRows(entity).pipe(
      retry(1),
      catchError(() => of({ data: [] }))
    );
  }

  private _safeTarifas(): Observable<TarifaListResponse> {
    return this.cflApi.listTarifas().pipe(
      retry(1),
      catchError(() => of({ data: [], temporada_id: null }))
    );
  }

  private _loadProductoresDeferred(): void {
    this._safeCatalog('productores').pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => {
      this.productores = res.data as Record<string, unknown>[];
      this.productorOptions = this._mapOptions(this.productores, 'id_productor', ['codigo_proveedor', 'nombre', 'rut']);
      this._applyProductorFallback();

      const cached = EditFleteModalComponent.catalogCache;
      if (cached) {
        EditFleteModalComponent.catalogCache = {
          ...cached,
          loadedAt: Date.now(),
          productores: this.productores,
        };
      }
    });
  }

  private _applyCatalogSnapshot(snapshot: CatalogCacheSnapshot): void {
    this.tiposFlete = snapshot.tiposFlete;
    this.tiposCamion = snapshot.tiposCamion || [];
    this.centrosCosto = snapshot.centrosCosto;
    this.detallesViaje = snapshot.detallesViaje;
    this.nodos = snapshot.nodos;
    this.rutas = snapshot.rutas;
    this.tarifas = snapshot.tarifas;
    this.empresas = snapshot.empresas;
    this.choferes = snapshot.choferes;
    this.camiones = snapshot.camiones;
    this.cuentasMayor = snapshot.cuentasMayor;
    this.imputacionesFlete = snapshot.imputacionesFlete;
    this.especies = snapshot.especies;
    this.productores = snapshot.productores;
    this.currentTemporadaId = snapshot.temporadaId;
    this.currentTemporadaLabel = snapshot.temporadaLabel;

    this.tipoFleteOptions = this._mapOptions(this.tiposFlete, 'id_tipo_flete', ['nombre', 'sap_codigo']);
    this.tipoCamionOptions = this._mapOptions(this.tiposCamion, 'id_tipo_camion', ['nombre', 'categoria']);
    this.centroCostoOptions = this._mapOptions(this.centrosCosto, 'id_centro_costo', ['sap_codigo', 'nombre']);
    this.detalleViajeOptions = this._mapOptions(this.detallesViaje, 'id_detalle_viaje', ['descripcion']);
    this.nodoOptions = this._mapOptions(this.nodos, 'id_nodo', ['nombre']);
    this.empresaOptions = this._mapOptions(this.empresas, 'id_empresa', ['sap_codigo', 'razon_social']);
    this.choferOptions = this._mapOptions(this.choferes, 'id_chofer', ['sap_nombre', 'sap_id_fiscal']);
    this.camionOptions = this._mapOptions(this.camiones, 'id_camion', ['sap_patente', 'sap_carro']);
    this.productorOptions = this._mapOptions(this.productores, 'id_productor', ['codigo_proveedor', 'nombre', 'rut']);
    this.cuentaMayorOptions = this._mapOptions(this.cuentasMayor, 'id_cuenta_mayor', ['codigo', 'glosa']);
    this._rebuildImputacionIndexes();
    this.especieOptions = this._mapOptions(this.especies, 'id_especie', ['glosa']);
  }

  private _hydrateCandidate(response: DashboardDetalleResponse): void {
    const cabecera = response.data?.cabecera ?? {};
    const posiciones = response.data?.posiciones ?? [];

    this.sapSnapshot = cabecera;
    this.form.patchValue({
      numero_entrega: this._toString(cabecera['sap_numero_entrega']) || this.getControlValue('numero_entrega'),
      guia_remision: this._toString(cabecera['sap_guia_remision']) || this.getControlValue('guia_remision'),
      id_productor: this._toControlValue(cabecera['id_productor']),
      fecha_salida: this._formatDate(cabecera['sap_fecha_salida']) || this.getControlValue('fecha_salida'),
      hora_salida: this._formatTime(cabecera['sap_hora_salida']) || this.getControlValue('hora_salida'),
    });
    this.detailRows.set(posiciones.map((row) => this._fromSapRow(row)));
    this._applyFallbacks(true);
  }

  private _hydrateExisting(response: FleteDetalleResponse): void {
    const cabecera = response.data?.cabecera ?? {};
    const detalles = response.data?.detalles ?? [];

    this.sapSnapshot = null;
    if (cabecera['sap_numero_entrega']) {
      this.sapSnapshot = {
        sap_numero_entrega: cabecera['sap_numero_entrega'],
        sap_guia_remision: cabecera['sap_guia_remision'],
        sap_destinatario: cabecera['sap_destinatario'],
        id_productor: cabecera['id_productor'],
        productor_id_resuelto: cabecera['productor_id_resuelto'],
        productor_codigo_proveedor: cabecera['productor_codigo_proveedor'],
        productor_rut: cabecera['productor_rut'],
        productor_nombre: cabecera['productor_nombre'],
        productor_email: cabecera['productor_email'],
        sap_codigo_tipo_flete: cabecera['sap_codigo_tipo_flete'],
        sap_centro_costo: cabecera['sap_centro_costo'],
        sap_cuenta_mayor: cabecera['sap_cuenta_mayor'],
      };
    }

    this.form.patchValue({
      numero_entrega: this._toControlValue(cabecera['numero_entrega']),
      guia_remision: this._toControlValue(cabecera['guia_remision']),
      tipo_movimiento: this._toControlValue(cabecera['tipo_movimiento']) || 'PUSH',
      id_tipo_flete: this._toControlValue(cabecera['id_tipo_flete']),
      id_tipo_camion: this._toControlValue(cabecera['id_tipo_camion']),
      id_imputacion_flete: this._toControlValue(cabecera['id_imputacion_flete']),
      id_centro_costo: this._toControlValue(cabecera['id_centro_costo']),
      id_detalle_viaje: this._toControlValue(cabecera['id_detalle_viaje']),
      id_origen_nodo: this._toControlValue(cabecera['id_origen_nodo']),
      id_destino_nodo: this._toControlValue(cabecera['id_destino_nodo']),
      id_ruta: this._toControlValue(cabecera['id_ruta']),
      id_tarifa: this._toControlValue(cabecera['id_tarifa']),
      fecha_salida: this._formatDate(cabecera['fecha_salida']),
      hora_salida: this._formatTime(cabecera['hora_salida']),
      id_empresa_transporte: this._toControlValue(cabecera['id_empresa_transporte']),
      id_chofer: this._toControlValue(cabecera['id_chofer']),
      id_camion: this._toControlValue(cabecera['id_camion']),
      id_productor: this._toControlValue(cabecera['id_productor']),
      monto_aplicado: cabecera['monto_aplicado'] ?? null,
      id_cuenta_mayor: this._toControlValue(cabecera['id_cuenta_mayor']),
      observaciones: this._toControlValue(cabecera['observaciones']),
    });
    this.detailRows.set(detalles.map((row) => this._fromExistingRow(row)));
    this._applyFallbacks(true);
  }

  private _isCurrentContext(contextVersion: number): boolean {
    return contextVersion === this.contextVersion && this.visible;
  }

  private _applyFallbacks(preserveExistingAmount: boolean): void {
    this._applySapDefaults();
    this._applyProductorFallback();
    this._applyTransportFallbacks();
    this._syncTipoCamionFromCamion();
    this._syncImputacionFromFields();
    this._refreshRouteNodeFilters(false);
    this._syncRouteAndTarifa(preserveExistingAmount);
    this._refreshRouteNodeFilters(false);
  }

  private _applyProductorFallback(): void {
    if (this.getControlValue('id_productor')) return;

    const explicitProductorId =
      this._toControlValue(this.sapSnapshot?.['id_productor'])
      || this._toControlValue(this.sapSnapshot?.['productor_id_resuelto'])
      || this._toControlValue(this.flete?.idProductor);
    if (explicitProductorId) {
      this.form.get('id_productor')?.setValue(explicitProductorId);
      return;
    }

    const hints = [
      this._toString(this.sapSnapshot?.['sap_destinatario']),
      this._toString(this.sapSnapshot?.['productor_codigo_proveedor']),
      this._toString(this.sapSnapshot?.['productor_rut']),
      this.flete?.sapDestinatario ?? null,
      this.flete?.productorCodigoProveedor ?? null,
      this.flete?.productorRut ?? null,
    ]
      .map((value) => this._normalized(value))
      .filter((value) => Boolean(value));

    if (hints.length === 0) return;

    const match = this.productores.find((row) => {
      const codigo = this._normalized(row['codigo_proveedor']);
      const rut = this._normalized(row['rut']);
      return hints.includes(codigo) || hints.includes(rut);
    });

    if (match) {
      this.form.get('id_productor')?.setValue(String(match['id_productor']));
    }
  }

  private _applySapDefaults(): void {
    if (!this.sapSnapshot) return;

    if (!this.getControlValue('id_tipo_flete')) {
      const sapCodigo = this._normalized(this.sapSnapshot['sap_codigo_tipo_flete']);
      const match = this.tiposFlete.find((row) => this._normalized(row['sap_codigo']) === sapCodigo);
      if (match) {
        this.form.get('id_tipo_flete')?.setValue(String(match['id_tipo_flete']));
      }
    }

    const tipoId = this.getControlValue('id_tipo_flete');
    const sapCentro = this._normalized(this.sapSnapshot['sap_centro_costo']);
    const sapCuenta = this._normalized(this.sapSnapshot['sap_cuenta_mayor']);

    if (tipoId && !this.getControlValue('id_imputacion_flete')) {
      const imputacionSap = this._getImputacionesByTipo(tipoId).find((row) =>
        this._normalized(row['centro_costo_sap_codigo']) === sapCentro
        && this._normalized(row['cuenta_mayor_codigo']) === sapCuenta
      );
      if (imputacionSap) {
        this.form.patchValue({
          id_imputacion_flete: this._toControlValue(imputacionSap['id_imputacion_flete']),
          id_centro_costo: this._toControlValue(imputacionSap['id_centro_costo']),
          id_cuenta_mayor: this._toControlValue(imputacionSap['id_cuenta_mayor']),
        }, { emitEvent: false });
      }
    }

    if (!this.getControlValue('id_centro_costo')) {
      const byCentro = this.centrosCosto.find((row) => this._normalized(row['sap_codigo']) === sapCentro);
      if (byCentro) {
        this.form.get('id_centro_costo')?.setValue(String(byCentro['id_centro_costo']));
      }
    }

    if (!this.getControlValue('id_cuenta_mayor')) {
      const match = this.cuentasMayor.find((row) => this._normalized(row['codigo']) === sapCuenta);
      if (match) {
        this.form.get('id_cuenta_mayor')?.setValue(String(match['id_cuenta_mayor']));
      }
    }
  }

  private _isRowActive(row: Record<string, unknown>): boolean {
    const raw = row['activo'];
    if (raw === null || raw === undefined) return true;
    return raw === true || raw === 1 || String(raw).toLowerCase() === 'true';
  }

  private _getImputacionesByTipo(tipoId: string): Record<string, unknown>[] {
    if (!tipoId) return [];
    return this.imputacionesByTipo.get(tipoId) || [];
  }

  private _findImputacionById(idImputacion: string): Record<string, unknown> | null {
    if (!idImputacion) return null;
    return this.imputacionesById.get(idImputacion) || null;
  }

  private _applyImputacionSelection(idImputacion: string): void {
    const imputacion = this._findImputacionById(idImputacion);
    if (!imputacion) {
      return;
    }

    this.form.patchValue({
      id_tipo_flete: this._toControlValue(imputacion['id_tipo_flete']),
      id_centro_costo: this._toControlValue(imputacion['id_centro_costo']),
      id_cuenta_mayor: this._toControlValue(imputacion['id_cuenta_mayor']),
      id_imputacion_flete: this._toControlValue(imputacion['id_imputacion_flete']),
    }, { emitEvent: false });
  }

  private _syncImputacionFromFields(): void {
    const tipoId = this.getControlValue('id_tipo_flete');
    if (!tipoId) {
      this.form.patchValue({ id_imputacion_flete: '' }, { emitEvent: false });
      return;
    }

    const imputaciones = this._getImputacionesByTipo(tipoId);
    if (imputaciones.length === 0) {
      this.form.patchValue({ id_imputacion_flete: '' }, { emitEvent: false });
      return;
    }

    const centroId = this.getControlValue('id_centro_costo');
    const cuentaId = this.getControlValue('id_cuenta_mayor');

    const exact = imputaciones.find((row) =>
      String(row['id_centro_costo']) === centroId
      && String(row['id_cuenta_mayor']) === cuentaId
    );
    if (exact) {
      this.form.patchValue({
        id_imputacion_flete: this._toControlValue(exact['id_imputacion_flete']),
      }, { emitEvent: false });
      return;
    }

    if (!centroId && !cuentaId && imputaciones.length === 1) {
      const only = imputaciones[0];
      this.form.patchValue({
        id_imputacion_flete: this._toControlValue(only['id_imputacion_flete']),
        id_centro_costo: this._toControlValue(only['id_centro_costo']),
        id_cuenta_mayor: this._toControlValue(only['id_cuenta_mayor']),
      }, { emitEvent: false });
      return;
    }

    if (centroId && !cuentaId) {
      const byCentro = imputaciones.filter((row) => String(row['id_centro_costo']) === centroId);
      if (byCentro.length === 1) {
        const only = byCentro[0];
        this.form.patchValue({
          id_imputacion_flete: this._toControlValue(only['id_imputacion_flete']),
          id_cuenta_mayor: this._toControlValue(only['id_cuenta_mayor']),
        }, { emitEvent: false });
        return;
      }
    }

    this.form.patchValue({ id_imputacion_flete: '' }, { emitEvent: false });
  }

  private _rebuildImputacionIndexes(): void {
    this.imputacionesByTipo.clear();
    this.imputacionesById.clear();

    for (const row of this.imputacionesFlete) {
      if (!this._isRowActive(row)) continue;

      const idImputacion = this._toControlValue(row['id_imputacion_flete']);
      const tipoId = this._toControlValue(row['id_tipo_flete']);

      if (idImputacion) {
        this.imputacionesById.set(idImputacion, row);
      }
      if (!tipoId) {
        continue;
      }

      const existing = this.imputacionesByTipo.get(tipoId);
      if (existing) {
        existing.push(row);
      } else {
        this.imputacionesByTipo.set(tipoId, [row]);
      }
    }
  }

  private _applyTransportFallbacks(): void {
    const empresaHint = this._toString(this.sapSnapshot?.['sap_empresa_transporte']) || this.flete?.sapEmpresaTransporte || '';
    const choferHint = this._toString(this.sapSnapshot?.['sap_nombre_chofer']) || this.flete?.sapNombreChofer || '';
    const patenteHint = this._toString(this.sapSnapshot?.['sap_patente']) || this.flete?.sapPatente || '';
    const carroHint = this._toString(this.sapSnapshot?.['sap_carro']) || this.flete?.sapCarro || '';

    if (!this.getControlValue('id_empresa_transporte') && empresaHint) {
      const empresa = this.empresas.find((row) =>
        this._normalized(row['sap_codigo']) === this._normalized(empresaHint) ||
        this._normalized(row['razon_social']) === this._normalized(empresaHint) ||
        this._normalized(row['rut']) === this._normalized(empresaHint)
      );
      if (empresa) {
        this.form.get('id_empresa_transporte')?.setValue(String(empresa['id_empresa']));
      }
    }

    if (!this.getControlValue('id_chofer') && choferHint) {
      const chofer = this.choferes.find((row) =>
        this._normalized(row['sap_nombre']) === this._normalized(choferHint) ||
        this._normalized(row['sap_id_fiscal']) === this._normalized(choferHint)
      );
      if (chofer) {
        this.form.get('id_chofer')?.setValue(String(chofer['id_chofer']));
      }
    }

    if (!this.getControlValue('id_camion') && (patenteHint || carroHint)) {
      const camion = this.camiones.find((row) =>
        (patenteHint && this._normalized(row['sap_patente']) === this._normalized(patenteHint)) ||
        (carroHint && this._normalized(row['sap_carro']) === this._normalized(carroHint))
      );
      if (camion) {
        this.form.get('id_camion')?.setValue(String(camion['id_camion']));
      }
    }
  }

  private _syncTipoCamionFromCamion(camionIdOverride?: string): void {
    const camionId = camionIdOverride ?? this.getControlValue('id_camion');
    if (!camionId) return;

    const camion = this.camiones.find((row) => String(row['id_camion']) === camionId) || null;
    const camionTipo = this._toControlValue(camion?.['id_tipo_camion']);
    if (!camionTipo) return;

    const currentTipo = this.getControlValue('id_tipo_camion');
    if (currentTipo !== camionTipo) {
      this.form.patchValue({ id_tipo_camion: camionTipo }, { emitEvent: false });
    }
  }

  private _getEffectiveTipoCamionId(): string {
    const explicitTipo = this.getControlValue('id_tipo_camion');
    if (explicitTipo) return explicitTipo;

    const selectedCamion = this.camiones.find((row) => String(row['id_camion']) === this.getControlValue('id_camion')) || null;
    return this._toControlValue(selectedCamion?.['id_tipo_camion']);
  }

  private _getSeasonTarifas(routeId?: string): Record<string, unknown>[] {
    const departureDate = this.getControlValue('fecha_salida') || this._formatDate(new Date());
    return this.tarifas
      .filter((row) => !routeId || String(row['id_ruta']) === routeId)
      .filter((row) => this._isTarifaVigente(row, departureDate));
  }

  private _getEligibleTarifasForDestino(routeId?: string): Record<string, unknown>[] {
    const selectedTipoCamion = this._getEffectiveTipoCamionId();
    return this._getSeasonTarifas(routeId)
      .filter((row) => !selectedTipoCamion || String(row['id_tipo_camion']) === selectedTipoCamion);
  }

  private _getAllowedRouteIdsForOrigen(): Set<string> {
    const routeIds = this._getSeasonTarifas()
      .map((row) => this._toControlValue(row['id_ruta']))
      .filter((value) => Boolean(value));
    return new Set(routeIds);
  }

  private _getAllowedRouteIdsForDestino(): Set<string> {
    const routeIds = this._getEligibleTarifasForDestino()
      .map((row) => this._toControlValue(row['id_ruta']))
      .filter((value) => Boolean(value));
    return new Set(routeIds);
  }

  private _getAllowedOriginNodeIds(): Set<string> {
    const allowedRouteIds = this._getAllowedRouteIdsForOrigen();
    const origins = this.rutas
      .filter((row) => this._isRowActive(row))
      .filter((row) => allowedRouteIds.has(this._toControlValue(row['id_ruta'])))
      .map((row) => this._toControlValue(row['id_origen_nodo']))
      .filter((value) => Boolean(value));
    return new Set(origins);
  }

  private _getAllowedDestinationNodeIds(origenId: string): Set<string> {
    if (!origenId) return new Set();

    const allowedRouteIds = this._getAllowedRouteIdsForDestino();
    const destinations = this.rutas
      .filter((row) => this._isRowActive(row))
      .filter((row) => this._toControlValue(row['id_origen_nodo']) === origenId)
      .filter((row) => allowedRouteIds.has(this._toControlValue(row['id_ruta'])))
      .map((row) => this._toControlValue(row['id_destino_nodo']))
      .filter((value) => Boolean(value));
    return new Set(destinations);
  }

  private _refreshRouteNodeFilters(clearInvalidDestinoOnOriginChange: boolean): void {
    const selectedOrigen = this.getControlValue('id_origen_nodo');
    let selectedDestino = this.getControlValue('id_destino_nodo');

    const allowedOrigen = this._getAllowedOriginNodeIds();
    if (allowedOrigen.size === 0) {
      this.origenNodoOptions = this.nodoOptions;
    } else {
      this.origenNodoOptions = this.nodoOptions.filter(
        (opt) => allowedOrigen.has(opt.value) || opt.value === selectedOrigen
      );
    }

    if (!selectedOrigen) {
      this.destinoNodoOptions = [];
      this.destinoHintLabel = 'Selecciona un origen para filtrar los destinos con tarifa vigente.';
      return;
    }

    const allowedDestino = this._getAllowedDestinationNodeIds(selectedOrigen);
    if (clearInvalidDestinoOnOriginChange && selectedDestino && !allowedDestino.has(selectedDestino)) {
      this.form.patchValue({ id_destino_nodo: '', id_ruta: '', id_tarifa: '' }, { emitEvent: false });
      selectedDestino = '';
    }

    this.destinoNodoOptions = this.nodoOptions.filter(
      (opt) => allowedDestino.has(opt.value) || opt.value === selectedDestino
    );
    const hasTipoCamion = Boolean(this._getEffectiveTipoCamionId());
    this.destinoHintLabel = allowedDestino.size === 0
      ? (hasTipoCamion
        ? 'No hay destinos con tarifa vigente para este origen y tipo de camion en la temporada actual.'
        : 'No hay destinos con tarifa vigente para este origen en la temporada actual.')
      : (hasTipoCamion
        ? 'Destinos filtrados por origen, temporada activa y tipo de camion.'
        : 'Destinos filtrados por origen y temporada activa.');
  }

  private _syncRouteAndTarifa(preserveExistingAmount: boolean): void {
    const explicitRouteId = this.getControlValue('id_ruta');
    const currentTarifaId = this.getControlValue('id_tarifa');
    const currentMonto = this._toNullableNumber(this.form.get('monto_aplicado')?.value);
    let route = this._findRouteByNodes();

    if (!route && explicitRouteId) {
      route = this.rutas.find((row) => String(row['id_ruta']) === explicitRouteId) || null;
      if (route) {
        this.form.patchValue({
          id_origen_nodo: this._toControlValue(route['id_origen_nodo']),
          id_destino_nodo: this._toControlValue(route['id_destino_nodo']),
        }, { emitEvent: false });
      }
    }

    if (!route) {
      this.form.patchValue({ id_ruta: '', id_tarifa: '' }, { emitEvent: false });
      if (!preserveExistingAmount) {
        this.form.get('monto_aplicado')?.setValue(null);
      }
      this.resolvedRouteName = '';
      this.resolvedRouteDistanceKm = null;
      this.resolvedRouteMonto = preserveExistingAmount ? currentMonto : null;
      this.resolvedRouteMoneda = '';
      this.routeResolutionHint = 'Selecciona origen y destino para resolver la ruta.';
      return;
    }

    this.form.patchValue({ id_ruta: String(route['id_ruta']) }, { emitEvent: false });
    this.resolvedRouteName = this._toString(route['nombre_ruta']) || '';
    this.resolvedRouteDistanceKm = this._toNullableNumber(route['distancia_km']);

    const tarifa = this._findBestTarifaForRoute(String(route['id_ruta']));
    if (tarifa) {
      const monto = this._toNullableNumber(tarifa['monto_fijo']);
      this.form.patchValue(
        {
          id_tarifa: this._toControlValue(tarifa['id_tarifa']),
          monto_aplicado: monto,
        },
        { emitEvent: false }
      );
      this.resolvedRouteMonto = monto;
      this.resolvedRouteMoneda = this._toString(tarifa['moneda']) || '';
      this.routeResolutionHint = this.currentTemporadaLabel
        ? `Tarifa resuelta para la temporada ${this.currentTemporadaLabel}.`
        : 'Tarifa vigente resuelta automaticamente.';
      return;
    }

    if (!preserveExistingAmount || !currentTarifaId) {
      this.form.patchValue({ id_tarifa: '' }, { emitEvent: false });
    }
    if (!preserveExistingAmount) {
      this.form.get('monto_aplicado')?.setValue(null);
    }
    this.resolvedRouteMonto = preserveExistingAmount ? currentMonto : null;
    this.resolvedRouteMoneda = '';
    this.routeResolutionHint = this._getEffectiveTipoCamionId()
      ? 'No existe una tarifa vigente para esta ruta y tipo de camion en la temporada actual.'
      : 'La ruta se resolvio, pero falta tipo de camion o no hay tarifa vigente para estimar el valor.';
  }

  private _findRouteByNodes(): Record<string, unknown> | null {
    const origenId = this.getControlValue('id_origen_nodo');
    const destinoId = this.getControlValue('id_destino_nodo');
    if (!origenId || !destinoId) return null;

    return (
      this.rutas.find(
        (row) =>
          String(row['id_origen_nodo']) === origenId &&
          String(row['id_destino_nodo']) === destinoId
      ) || null
    );
  }

  private _findBestTarifaForRoute(routeId: string): Record<string, unknown> | null {
    const candidates = this._getEligibleTarifasForDestino(routeId)
      .sort((a, b) => {
        const priorityA = Number(a['prioridad'] ?? 999999);
        const priorityB = Number(b['prioridad'] ?? 999999);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return Number(a['id_tarifa'] ?? 0) - Number(b['id_tarifa'] ?? 0);
      });

    if (candidates.length === 0) return null;
    if (this._getEffectiveTipoCamionId()) return candidates[0];
    return candidates.length === 1 ? candidates[0] : null;
  }

  private _isTarifaVigente(row: Record<string, unknown>, fechaIso: string): boolean {
    const start = this._toString(row['vigencia_desde']);
    const end = this._toString(row['vigencia_hasta']);
    const active = row['activo'];

    if (active !== undefined && active !== null && Number(active) === 0) return false;
    if (start && fechaIso < start.slice(0, 10)) return false;
    if (end && fechaIso > end.slice(0, 10)) return false;
    return true;
  }

  private _buildPayload(): { cabecera: Record<string, unknown>; detalles: Record<string, unknown>[] } {
    const cabeceraForm: Record<string, unknown> = { ...this.form.value };
    for (const key of Object.keys(cabeceraForm)) {
      if (cabeceraForm[key] === '' || cabeceraForm[key] === undefined) {
        cabeceraForm[key] = null;
      }
    }

    if (this.sapSnapshot) {
      for (const key of ['sap_numero_entrega', 'sap_codigo_tipo_flete', 'sap_centro_costo', 'sap_cuenta_mayor']) {
        const value = this._toString(this.sapSnapshot[key]);
        if (value) cabeceraForm[key] = value;
      }
    }

    const cabecera = cabeceraForm;
    delete cabecera['id_tipo_camion'];
    delete cabecera['id_origen_nodo'];
    delete cabecera['id_destino_nodo'];
    delete cabecera['id_ruta'];

    const detalles = this.detailRows()
      .map((row) => {
        const material = this._trimOrNull(row.material);
        const descripcion = this._trimOrNull(row.descripcion);
        const cantidad = row.cantidad === '' ? null : Number(row.cantidad);
        const unidad = this._trimOrNull(row.unidad);
        const peso = row.peso === '' ? null : Number(row.peso);
        const idEspecie = row.id_especie || null;

        const hasContent = Boolean(
          idEspecie ||
          material ||
          descripcion ||
          unidad ||
          (cantidad !== null && Number.isFinite(cantidad)) ||
          (peso !== null && Number.isFinite(peso))
        );

        if (!hasContent) return null;

        return {
          id_especie: idEspecie,
          material,
          descripcion,
          cantidad: Number.isFinite(cantidad) ? cantidad : null,
          unidad: unidad ? unidad.slice(0, 3) : null,
          peso: Number.isFinite(peso) ? peso : null,
        };
      })
      .filter((row) => row !== null) as Record<string, unknown>[];

    return { cabecera, detalles };
  }

  private _mapOptions(source: Record<string, unknown>[], valueField: string, labelFields: string[]): SearchableOption[] {
    return source
      .map((item) => {
        const value = item[valueField];
        if (value === null || value === undefined || value === '') return null;
        const label = labelFields
          .map((field) => this._toString(item[field]))
          .filter((part) => Boolean(part))
          .join(' - ');
        return { value: String(value), label: label || String(value) };
      })
      .filter((item): item is SearchableOption => item !== null);
  }

  private _findNodoLabel(id: string): string {
    if (!id) return '';
    const node = this.nodos.find((row) => String(row['id_nodo']) === id);
    return this._toString(node?.['nombre']) || '';
  }

  private _createEmptyDetailRow(): DetalleDraft {
    return {
      rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id_especie: '',
      material: '',
      descripcion: '',
      cantidad: '',
      unidad: '',
      peso: '',
      sap_posicion: '',
      sap_posicion_superior: '',
      sap_lote: '',
    };
  }

  private _fromSapRow(row: Record<string, unknown>): DetalleDraft {
    const unidad = this._toString(row['sap_unidad_peso']) || '';
    const cantidad = this._toControlValue(row['sap_cantidad_entregada']);
    return {
      ...this._createEmptyDetailRow(),
      material: this._toControlValue(row['sap_material']),
      descripcion: this._toControlValue(row['sap_denominacion_material']),
      cantidad,
      unidad: unidad.slice(0, 3),
      peso: unidad.toUpperCase().startsWith('KG') ? cantidad : '',
      sap_posicion: this._toControlValue(row['sap_posicion']),
      sap_posicion_superior: this._toControlValue(row['sap_posicion_superior']),
      sap_lote: this._toControlValue(row['sap_lote']),
    };
  }

  private _fromExistingRow(row: Record<string, unknown>): DetalleDraft {
    return {
      ...this._createEmptyDetailRow(),
      id_especie: this._toControlValue(row['id_especie']),
      material: this._toControlValue(row['material']),
      descripcion: this._toControlValue(row['descripcion']),
      cantidad: this._toControlValue(row['cantidad']),
      unidad: this._toControlValue(row['unidad']),
      peso: this._toControlValue(row['peso']),
      sap_posicion: this._toControlValue(row['sap_posicion']),
      sap_posicion_superior: this._toControlValue(row['sap_posicion_superior']),
      sap_lote: this._toControlValue(row['sap_lote']),
    };
  }

  private _updateDetailRow(rowId: string, patch: Partial<DetalleDraft>): void {
    this.detailRows.update((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  private _trimOrNull(value: string): string | null {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private _toString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const result = String(value).trim();
    return result ? result : null;
  }

  private _toControlValue(value: unknown): string {
    return this._toString(value) || '';
  }

  private _toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private _normalized(value: unknown): string {
    return this._toString(value)?.toLowerCase() || '';
  }

  private _formatDate(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const raw = String(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  private _formatTime(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(11, 16);
    const raw = String(value);
    const match = raw.match(/(\d{2}:\d{2})(?::\d{2})?/);
    if (match) return match[1];
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(11, 16);
  }
}
