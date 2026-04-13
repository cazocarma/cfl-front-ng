import {
  ChangeDetectionStrategy,
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
import { Observable } from 'rxjs';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { FleteCatalogService } from '../../../core/services/flete-catalog.service';
import { FleteRouteResolverService } from '../../../core/services/flete-route-resolver.service';
import { FleteTabla } from '../../../core/models/flete.model';
import { toLocalDateInput, toLocalTimeInput } from '../../../core/utils/format.utils';
import {
  trimOrNull,
  toString as fleteToString,
  toControlValue,
  toNullableNumber,
  normalized as fleteNormalized,
  formatDateValue,
  formatTimeValue,
} from '../../../core/utils/flete-form.utils';
import {
  SearchableComboboxComponent,
  SearchableOption,
} from '../searchable-combobox.component';
import { DetallesTabComponent } from './detalles-tab.component';
import { SapSnapshotCardComponent } from './sap-snapshot-card.component';
import { RouteSummaryCardComponent } from './route-summary-card.component';
import {
  ModalTab,
  ModalMode,
  DetalleDraft,
  DashboardDetalleResponse,
  FleteDetalleResponse,
  TarifaListResponse,
  CatalogCacheSnapshot,
  groupDetailRows,
} from './edit-flete-modal.types';

export { ModalMode } from './edit-flete-modal.types';

@Component({
    selector: 'app-edit-flete-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, SearchableComboboxComponent, DetallesTabComponent, SapSnapshotCardComponent, RouteSummaryCardComponent],
    templateUrl: './edit-flete-modal.component.html',
    styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5;
    }

    .detail-chip {
      @apply inline-flex items-center rounded-full border border-forest-200 bg-white px-2.5 py-1 text-[11px] font-medium text-forest-700;
    }

  `]
})
export class EditFleteModalComponent implements OnChanges {
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
  refreshingCatalogs = signal(false);
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
  productorOptions = signal<SearchableOption[]>([]);
  destinoHintLabel = 'Selecciona un origen para filtrar los destinos con tarifa vigente.';

  detailRows = signal<DetalleDraft[]>([]);


  sapSnapshot: Record<string, unknown> | null = null;
  currentTemporadaId: number | null = null;
  currentTemporadaLabel = '';
  resolvedRouteName = '';
  resolvedRouteDistanceKm: number | null = null;
  resolvedRouteMonto: number | null = null;
  resolvedRouteMoneda = '';
  routeResolutionHint = 'Selecciona origen y destino para resolver la ruta.';
  resolvedSentido: 'IDA' | 'VUELTA' | null = null;
  private imputacionesByTipo = new Map<string, Record<string, unknown>[]>();
  private imputacionesById = new Map<string, Record<string, unknown>>();

  readonly tipoMovimientoOptions: SearchableOption[] = [
    { value: 'PUSH', label: 'Despacho' },
    { value: 'PULL', label: 'Retorno' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogService = inject(FleteCatalogService);
  private readonly routeResolver = inject(FleteRouteResolverService);

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
      id_especie: [''],
      monto_aplicado: [null],
      monto_extra: [0],
      sentido_flete: [''],
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

  /**
   * Recarga catálogos e información del flete sin perder los valores del formulario.
   */
  refreshCatalogs(): void {
    this.refreshingCatalogs.set(true);
    this.catalogService.invalidateCache();
    this.catalogService.loadAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (snapshot) => {
        this._applyCatalogSnapshot(snapshot);
        this._refreshRouteNodeFilters(false);
        this._syncRouteAndTarifa(true);
        this._syncImputacionFromFields();
        this.refreshingCatalogs.set(false);
        this._loadProductoresDeferred();
      },
      error: () => {
        this.errorMsg.set('Error actualizando catálogos. Intenta nuevamente.');
        this.refreshingCatalogs.set(false);
      },
    });
  }

  isReadOnly(): boolean {
    return this.mode === 'view';
  }

  getModalTitle(): string {
    if (this.mode === 'clonar') {
      return `Clonar movimiento #${this.flete?.numeroGuia ?? ''}`;
    }

    if (this.isReadOnly()) {
      if (!this.flete) return 'Ver flete manual';
      if (this.flete.kind === 'candidato') return `Ver candidato SAP #${this.flete.numeroGuia}`;
      return `Ver flete #${this.flete.numeroGuia}`;
    }

    if (!this.flete) return 'Ingreso manual de flete';
    if (this.flete.kind === 'candidato') {
      const origen = this.flete.origenDatos === 'RECEPCION' ? 'Romana' : 'SAP';
      return `Crear flete desde ${origen} #${this.flete.numeroGuia}`;
    }
    return `Editar flete #${this.flete.numeroGuia}`;
  }

  getModalSubtitle(): string {
    return this.isReadOnly()
      ? 'Informacion en modo solo lectura'
      : 'Completa la cabecera y revisa los detalles';
  }

  showSapSnapshot(): boolean {
    if (this.mode === 'clonar') return false;
    return this.isSapBacked();
  }

  isSapBacked(): boolean {
    if (this.mode === 'clonar') return false;
    return Boolean(this.flete?.kind === 'candidato' || this.getSapNumeroEntrega());
  }


  hasResolvedRoute(): boolean {
    return Boolean(this.resolvedRouteName);
  }

  hasResolvedMonto(): boolean {
    return this.resolvedRouteMonto !== null;
  }

  getSapNumeroEntrega(): string {
    if (this.mode === 'clonar') return '';
    return fleteToString(this.sapSnapshot?.['sap_numero_entrega']) || fleteToString(this.flete?.sapNumeroEntrega) || '';
  }

  /** Identificador SAP genérico: N° Entrega (LIKP) o N° Partida (Romana). */
  getSapIdentificador(): string {
    if (this.mode === 'clonar') return '';
    // Romana: NumeroPartida
    const romanaPartida = fleteToString(this.sapSnapshot?.['NumeroPartida']) || fleteToString(this.sapSnapshot?.['numero_partida']);
    if (romanaPartida) return romanaPartida;
    // LIKP: SapNumeroEntrega
    return this.getSapNumeroEntrega();
  }

  getSapGuiaRemision(): string {
    if (this.mode === 'clonar') return '';
    // Romana: GuiaDespacho
    const romanaGuia = fleteToString(this.sapSnapshot?.['GuiaDespacho']) || fleteToString(this.sapSnapshot?.['guia_despacho']);
    if (romanaGuia) return romanaGuia;
    return fleteToString(this.sapSnapshot?.['sap_guia_remision']) || fleteToString(this.flete?.sapGuiaRemision) || '';
  }

  getSapDestinatario(): string {
    if (this.mode === 'clonar') return '';
    // Romana: CodigoProductor (código) / ProductorDescripcion (fallback)
    const romanaProd = fleteToString(this.sapSnapshot?.['CodigoProductor']) || fleteToString(this.sapSnapshot?.['ProductorDescripcion']);
    if (romanaProd) return romanaProd;
    return fleteToString(this.sapSnapshot?.['sap_destinatario']) || fleteToString(this.flete?.sapDestinatario) || '';
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

  /** Aplica un porcentaje de la tarifa base como monto extra y recalcula el total. */
  setExtraPercentage(pct: number): void {
    if (this.isReadOnly() || this.resolvedRouteMonto === null) return;
    const extra = Math.round(this.resolvedRouteMonto * pct / 100);
    this.form.patchValue({ monto_extra: extra }, { emitEvent: false });
    this._recalcMontoAplicado();
  }

  /** Recalcula monto_aplicado = tarifa base + monto extra cuando el usuario cambia el extra manualmente. */
  onMontoExtraChange(): void {
    this._recalcMontoAplicado();
  }

  getMontoExtraValue(): number {
    return Number(this.form.get('monto_extra')?.value) || 0;
  }

  getMontoBaseLabel(): string {
    if (this.resolvedRouteMonto === null) return '-';
    const formatter = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return formatter.format(this.resolvedRouteMonto);
  }

  getMontoTotalLabel(): string {
    const monto = toNullableNumber(this.form.get('monto_aplicado')?.value);
    if (monto === null) return 'Sin tarifa vigente';
    const formatter = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const prefix = this.resolvedRouteMoneda ? `${this.resolvedRouteMoneda} ` : '';
    return `${prefix}${formatter.format(monto)}`;
  }

  private _recalcMontoAplicado(): void {
    const base = this.resolvedRouteMonto ?? 0;
    const extra = Number(this.form.get('monto_extra')?.value) || 0;
    const total = base + extra;
    this.form.patchValue({ monto_aplicado: total }, { emitEvent: false });
  }

  getRouteOriginLabel(): string {
    return this._findNodoLabel(this.getControlValue('id_origen_nodo')) || 'Origen';
  }

  getRouteDestinationLabel(): string {
    return this._findNodoLabel(this.getControlValue('id_destino_nodo')) || 'Destino';
  }

  getSentidoLabel(): string {
    if (!this.resolvedSentido) return '';
    return this.resolvedSentido === 'IDA' ? 'Ida' : 'Vuelta';
  }

  toggleSentido(): void {
    if (this.isReadOnly()) return;
    const o = this.getControlValue('id_origen_nodo');
    const d = this.getControlValue('id_destino_nodo');
    if (!o || !d) return;
    this.form.patchValue({ id_origen_nodo: d, id_destino_nodo: o }, { emitEvent: false });
    this._refreshRouteNodeFilters(false);
    this._syncRouteAndTarifa(true);
  }

  isInvalid(key: string): boolean {
    const ctrl = this.form.get(key);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onDateBlur(key: string): void {
    const value = this.getControlValue(key);
    if (value) {
      this.setControlValue(key, value);
    }
  }

  getControlValue(key: string): string {
    return toControlValue(this.form.get(key)?.value);
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
        const selectedCamionTipo = toControlValue(selectedCamion?.['id_tipo_camion']);
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
        .filter((row) => toControlValue(row['id_tipo_camion']) === selectedTipoCamion)
        .map((row) => toControlValue(row['id_camion']))
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

    const tipo = fleteToString(imputacion['tipo_flete_nombre']) || fleteToString(imputacion['tipo_flete_sap_codigo']) || 'Tipo';
    const centro = fleteToString(imputacion['centro_costo_sap_codigo']) || fleteToString(imputacion['centro_costo_nombre']) || 'Centro';
    const cuenta = fleteToString(imputacion['cuenta_mayor_codigo']) || fleteToString(imputacion['cuenta_mayor_glosa']) || 'Cuenta';
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
    return this.productorOptions();
  }

  getEspecieOptions(): SearchableOption[] {
    return this.especieOptions;
  }

  getSelectedProductor(): Record<string, unknown> | null {
    const idProductor = this.getControlValue('id_productor');
    if (!idProductor) return null;
    return this.productores.find((row) => String(row['id_productor']) === idProductor) || null;
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

    if (this.mode === 'clonar') {
      obs$ = this.cflApi.crearFleteManual(payload);
    } else if (this.flete?.kind === 'candidato' && this.flete.idSapEntrega) {
      const isRomana = this.flete.idSapEntrega < 0;
      obs$ = isRomana
        ? this.cflApi.crearCabeceraDesdeRomana(Math.abs(this.flete.idSapEntrega), payload)
        : this.cflApi.crearCabeceraDesdeCandidato(this.flete.idSapEntrega, payload);
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
    this.resolvedSentido = null;
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
    const isClonar = this.mode === 'clonar';

    this.form.reset({
      numero_entrega: isClonar ? '' : (this.flete?.numeroEntrega ?? ''),
      guia_remision: isClonar ? '' : (this.flete?.guiaRemision ?? ''),
      tipo_movimiento: this.flete?.origenDatos === 'RECEPCION' ? 'PULL' : 'PUSH',
      id_tipo_flete: toControlValue(this.flete?.idTipoFlete),
      id_tipo_camion: '',
      id_imputacion_flete: toControlValue(this.flete?.idImputacionFlete),
      id_centro_costo: toControlValue(this.flete?.idCentroCosto),
      id_detalle_viaje: toControlValue(this.flete?.idDetalleViaje),
      id_origen_nodo: '',
      id_destino_nodo: '',
      id_ruta: toControlValue(this.flete?.idRuta),
      id_tarifa: toControlValue(this.flete?.idTarifa),
      fecha_salida: formatDateValue(now),
      hora_salida: formatTimeValue(now),
      id_empresa_transporte: '',
      id_chofer: '',
      id_camion: '',
      id_productor: toControlValue(this.flete?.idProductor),
      id_especie: toControlValue(this.flete?.idEspecie),
      monto_aplicado: isClonar ? null : (this.flete?.monto ?? null),
      monto_extra: isClonar ? 0 : (this.flete?.montoExtra ?? 0),
      sentido_flete: '',
      id_cuenta_mayor: toControlValue(this.flete?.idCuentaMayor),
      observaciones: '',
    });
  }

  private _loadCatalogos(): void {
    this.loadingCatalogos.set(true);
    this.catalogService.loadAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (snapshot) => {
        this._applyCatalogSnapshot(snapshot);
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

      // Romana uses negative IDs
      const isRomana = this.flete.idSapEntrega < 0;
      const detailObs$ = isRomana
        ? this.cflApi.getRomanaEntregaDetalle(Math.abs(this.flete.idSapEntrega))
        : this.cflApi.getMissingFleteDetalle(this.flete.idSapEntrega);

      detailObs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          if (!this._isCurrentContext(contextVersion)) return;
          if (isRomana) {
            this._hydrateRomanaCandidate(res as any);
          } else {
            this._hydrateCandidate(res as DashboardDetalleResponse);
          }
          this.detailLoading.set(false);
        },
        error: (err) => {
          if (!this._isCurrentContext(contextVersion)) return;
          this.detailError.set(err?.error?.error ?? 'No se pudieron cargar las posiciones.');
          this.detailLoading.set(false);
        },
      });
      return;
    }

    if ((this.flete?.kind === 'en_curso' || this.mode === 'clonar') && this.flete?.idCabeceraFlete) {
      this.detailLoading.set(true);
      this.cflApi.getFleteById(this.flete.idCabeceraFlete).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          if (!this._isCurrentContext(contextVersion)) return;
          if (this.mode === 'clonar') {
            this._hydrateClonar(res as FleteDetalleResponse);
          } else {
            this._hydrateExisting(res as FleteDetalleResponse);
          }
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


  private _loadProductoresDeferred(): void {
    this.catalogService.loadProductoresDeferred().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productores) => {
      this.productores = productores;
      this.productorOptions.set(this.catalogService.mapOptions(this.productores, 'id_productor', ['codigo_proveedor', 'nombre', 'rut']));
      this._applyProductorFallback();
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

    this.tipoFleteOptions = this.catalogService.mapOptions(this.tiposFlete, 'id_tipo_flete', ['nombre', 'sap_codigo']);
    this.tipoCamionOptions = this.catalogService.mapOptions(this.tiposCamion, 'id_tipo_camion', ['nombre', 'categoria']);
    this.centroCostoOptions = this.catalogService.mapOptions(this.centrosCosto, 'id_centro_costo', ['sap_codigo', 'nombre']);
    this.detalleViajeOptions = this.catalogService.mapOptions(this.detallesViaje, 'id_detalle_viaje', ['descripcion']);
    this.nodoOptions = this.catalogService.mapOptions(this.nodos, 'id_nodo', ['nombre']);
    this.empresaOptions = this.catalogService.mapOptions(this.empresas, 'id_empresa', ['sap_codigo', 'razon_social']);
    this.choferOptions = this.catalogService.mapOptions(this.choferes, 'id_chofer', ['sap_nombre', 'sap_id_fiscal']);
    this.camionOptions = this.catalogService.mapOptions(this.camiones, 'id_camion', ['sap_patente', 'sap_carro']);
    this.productorOptions.set(this.catalogService.mapOptions(this.productores, 'id_productor', ['codigo_proveedor', 'nombre', 'rut']));
    this.cuentaMayorOptions = this.catalogService.mapOptions(this.cuentasMayor, 'id_cuenta_mayor', ['codigo', 'glosa']);
    this._rebuildImputacionIndexes();
    this.especieOptions = this.catalogService.mapOptions(this.especies, 'id_especie', ['glosa']);
  }

  private _hydrateCandidate(response: DashboardDetalleResponse): void {
    const cabecera = response.data?.cabecera ?? {};
    const posiciones = response.data?.posiciones ?? [];

    this.sapSnapshot = cabecera;
    this.form.patchValue({
      numero_entrega: fleteToString(cabecera['sap_numero_entrega']) || this.getControlValue('numero_entrega'),
      guia_remision: fleteToString(cabecera['sap_guia_remision']) || this.getControlValue('guia_remision'),
      id_productor: toControlValue(cabecera['id_productor']),
      fecha_salida: formatDateValue(cabecera['fecha_referencia']) || formatDateValue(cabecera['sap_fecha_salida']) || this.getControlValue('fecha_salida'),
      hora_salida: formatTimeValue(cabecera['sap_hora_salida']) || this.getControlValue('hora_salida'),
    });
    this.detailRows.set(posiciones.map((row) => this._fromSapRow(row)));
    this._applyFallbacks(true);
  }

  private _hydrateRomanaCandidate(response: any): void {
    const cabecera = response.data?.cabecera ?? {};
    const detalles = response.data?.detalles ?? [];

    this.sapSnapshot = cabecera;

    // Resolver especie desde EspecieDescripcion o CodigoEspecie del primer detalle
    const firstDetWithEspecie = detalles.find((d: Record<string, unknown>) =>
      fleteToString(d['EspecieDescripcion'] || d['especie_descripcion'] || d['CodigoEspecie'] || d['codigo_especie'])
    );
    let resolvedEspecieId = '';
    if (firstDetWithEspecie) {
      const especieDesc = fleteToString(firstDetWithEspecie['EspecieDescripcion'] || firstDetWithEspecie['especie_descripcion']);
      const especieCodigo = fleteToString(firstDetWithEspecie['CodigoEspecie'] || firstDetWithEspecie['codigo_especie']);
      const especieMatch = this.especies.find(
        (e) => (especieDesc && fleteNormalized(e['glosa']) === fleteNormalized(especieDesc))
          || (especieCodigo && fleteNormalized(e['glosa']) === fleteNormalized(especieCodigo))
      );
      if (especieMatch) resolvedEspecieId = String(especieMatch['id_especie']);
    }

    this.form.patchValue({
      numero_entrega: fleteToString(cabecera['NumeroPartida'] || cabecera['numero_partida']) || this.getControlValue('numero_entrega'),
      guia_remision: fleteToString(cabecera['GuiaDespacho'] || cabecera['guia_despacho']) || this.getControlValue('guia_remision'),
      fecha_salida: formatDateValue(cabecera['FechaCreacionSap'] || cabecera['fecha_creacion_sap']) || this.getControlValue('fecha_salida'),
      id_especie: resolvedEspecieId || this.getControlValue('id_especie'),
    });

    this.detailRows.set(detalles.map((row: Record<string, unknown>) => this._fromRomanaRow(row)));
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

    // Si sentido es VUELTA, intercambiar nodos canónicos para que
    // findRouteByNodes detecte correctamente el match reverso.
    const storedSentido = toControlValue(cabecera['sentido_flete']) || '';
    const canonOrigen = toControlValue(cabecera['id_origen_nodo']);
    const canonDestino = toControlValue(cabecera['id_destino_nodo']);
    const formOrigen = storedSentido === 'VUELTA' ? canonDestino : canonOrigen;
    const formDestino = storedSentido === 'VUELTA' ? canonOrigen : canonDestino;

    const dbMonto = cabecera['monto_aplicado'] ?? null;
    const dbMontoExtra = cabecera['monto_extra'] ?? 0;

    this.form.patchValue({
      numero_entrega: toControlValue(cabecera['numero_entrega']),
      guia_remision: toControlValue(cabecera['guia_remision']),
      tipo_movimiento: toControlValue(cabecera['tipo_movimiento']) || 'PUSH',
      id_tipo_flete: toControlValue(cabecera['id_tipo_flete']),
      id_tipo_camion: toControlValue(cabecera['id_tipo_camion']),
      id_imputacion_flete: toControlValue(cabecera['id_imputacion_flete']),
      id_centro_costo: toControlValue(cabecera['id_centro_costo']),
      id_detalle_viaje: toControlValue(cabecera['id_detalle_viaje']),
      id_origen_nodo: formOrigen,
      id_destino_nodo: formDestino,
      id_ruta: toControlValue(cabecera['id_ruta']),
      id_tarifa: toControlValue(cabecera['id_tarifa']),
      fecha_salida: formatDateValue(cabecera['fecha_salida']),
      hora_salida: formatTimeValue(cabecera['hora_salida']),
      id_empresa_transporte: toControlValue(cabecera['id_empresa_transporte']),
      id_chofer: toControlValue(cabecera['id_chofer']),
      id_camion: toControlValue(cabecera['id_camion']),
      id_productor: toControlValue(cabecera['id_productor']),
      monto_aplicado: dbMonto,
      sentido_flete: storedSentido,
      id_cuenta_mayor: toControlValue(cabecera['id_cuenta_mayor']),
      observaciones: toControlValue(cabecera['observaciones']),
    });
    this.detailRows.set(detalles.map((row) => this._fromExistingRow(row)));
    this._applyFallbacks(true);

    // Restaurar monto autoritativo del DB (applyFallbacks puede sobrescribirlo
    // al detectar "cambio de tarifa" durante la resolución)
    this.form.patchValue({
      monto_aplicado: dbMonto,
      monto_extra: dbMontoExtra,
    }, { emitEvent: false });
  }

  private _hydrateClonar(response: FleteDetalleResponse): void {
    const cabecera = response.data?.cabecera ?? {};
    const now = new Date();

    // Snapshot mínimo para que _applyProductorFallback pueda resolver por hints
    this.sapSnapshot = {
      id_productor: cabecera['id_productor'],
      productor_id_resuelto: cabecera['productor_id_resuelto'],
      productor_codigo_proveedor: cabecera['productor_codigo_proveedor'],
      productor_rut: cabecera['productor_rut'],
      sap_destinatario: cabecera['sap_destinatario'],
    };
    this.form.patchValue({
      // Copiar toda la estructura del flete origen tal cual
      tipo_movimiento: toControlValue(cabecera['tipo_movimiento']) || 'PUSH',
      id_tipo_flete: toControlValue(cabecera['id_tipo_flete']),
      id_imputacion_flete: toControlValue(cabecera['id_imputacion_flete']),
      id_centro_costo: toControlValue(cabecera['id_centro_costo']),
      id_detalle_viaje: toControlValue(cabecera['id_detalle_viaje']),
      id_origen_nodo: toControlValue(cabecera['id_origen_nodo']),
      id_destino_nodo: toControlValue(cabecera['id_destino_nodo']),
      id_ruta: toControlValue(cabecera['id_ruta']),
      id_tarifa: toControlValue(cabecera['id_tarifa']),
      id_empresa_transporte: toControlValue(cabecera['id_empresa_transporte']),
      id_chofer: toControlValue(cabecera['id_chofer']),
      id_camion: toControlValue(cabecera['id_camion']),
      id_productor: toControlValue(cabecera['id_productor']),
      id_cuenta_mayor: toControlValue(cabecera['id_cuenta_mayor']),
      sentido_flete: toControlValue(cabecera['sentido_flete']) || '',
      // Campos limpios para el clon
      numero_entrega: '',
      guia_remision: '',
      fecha_salida: formatDateValue(now),
      hora_salida: formatTimeValue(now),
      monto_aplicado: null,
      monto_extra: 0,
      observaciones: '',
    });
    const detalles = response.data?.detalles ?? [];
    this.detailRows.set(detalles.map((row) => this._fromExistingRow(row)));
    this._applyFallbacks(false);
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
      toControlValue(this.sapSnapshot?.['id_productor'])
      || toControlValue(this.sapSnapshot?.['productor_id_resuelto'])
      || toControlValue(this.flete?.idProductor);
    if (explicitProductorId) {
      this.form.get('id_productor')?.setValue(explicitProductorId);
      return;
    }

    const hints = [
      fleteToString(this.sapSnapshot?.['sap_destinatario']),
      fleteToString(this.sapSnapshot?.['productor_codigo_proveedor']),
      fleteToString(this.sapSnapshot?.['productor_rut']),
      fleteToString(this.sapSnapshot?.['CodigoProductor']),
      fleteToString(this.sapSnapshot?.['codigo_productor']),
      this.flete?.sapDestinatario ?? null,
      this.flete?.productorCodigoProveedor ?? null,
      this.flete?.productorRut ?? null,
    ]
      .map((value) => fleteNormalized(value))
      .filter((value) => Boolean(value));

    if (hints.length === 0) return;

    const match = this.productores.find((row) => {
      const codigo = fleteNormalized(row['codigo_proveedor']);
      const rut = fleteNormalized(row['rut']);
      return hints.includes(codigo) || hints.includes(rut);
    });

    if (match) {
      this.form.get('id_productor')?.setValue(String(match['id_productor']));
    }
  }

  private _applySapDefaults(): void {
    if (!this.sapSnapshot) return;

    if (!this.getControlValue('id_tipo_flete')) {
      const sapCodigo = fleteNormalized(this.sapSnapshot['sap_codigo_tipo_flete']);
      const match = this.tiposFlete.find((row) => fleteNormalized(row['sap_codigo']) === sapCodigo);
      if (match) {
        this.form.get('id_tipo_flete')?.setValue(String(match['id_tipo_flete']));
      }
    }

    const tipoId = this.getControlValue('id_tipo_flete');
    const sapCentro = fleteNormalized(this.sapSnapshot['sap_centro_costo']);
    const sapCuenta = fleteNormalized(this.sapSnapshot['sap_cuenta_mayor']);

    if (tipoId && !this.getControlValue('id_imputacion_flete')) {
      const imputacionSap = this._getImputacionesByTipo(tipoId).find((row) =>
        fleteNormalized(row['centro_costo_sap_codigo']) === sapCentro
        && fleteNormalized(row['cuenta_mayor_codigo']) === sapCuenta
      );
      if (imputacionSap) {
        this.form.patchValue({
          id_imputacion_flete: toControlValue(imputacionSap['id_imputacion_flete']),
          id_centro_costo: toControlValue(imputacionSap['id_centro_costo']),
          id_cuenta_mayor: toControlValue(imputacionSap['id_cuenta_mayor']),
        }, { emitEvent: false });
      }
    }

    if (!this.getControlValue('id_centro_costo')) {
      const byCentro = this.centrosCosto.find((row) => fleteNormalized(row['sap_codigo']) === sapCentro);
      if (byCentro) {
        this.form.get('id_centro_costo')?.setValue(String(byCentro['id_centro_costo']));
      }
    }

    if (!this.getControlValue('id_cuenta_mayor')) {
      const match = this.cuentasMayor.find((row) => fleteNormalized(row['codigo']) === sapCuenta);
      if (match) {
        this.form.get('id_cuenta_mayor')?.setValue(String(match['id_cuenta_mayor']));
      }
    }
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
      id_tipo_flete: toControlValue(imputacion['id_tipo_flete']),
      id_centro_costo: toControlValue(imputacion['id_centro_costo']),
      id_cuenta_mayor: toControlValue(imputacion['id_cuenta_mayor']),
      id_imputacion_flete: toControlValue(imputacion['id_imputacion_flete']),
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
        id_imputacion_flete: toControlValue(exact['id_imputacion_flete']),
      }, { emitEvent: false });
      return;
    }

    if (!centroId && !cuentaId && imputaciones.length === 1) {
      const only = imputaciones[0];
      this.form.patchValue({
        id_imputacion_flete: toControlValue(only['id_imputacion_flete']),
        id_centro_costo: toControlValue(only['id_centro_costo']),
        id_cuenta_mayor: toControlValue(only['id_cuenta_mayor']),
      }, { emitEvent: false });
      return;
    }

    if (centroId && !cuentaId) {
      const byCentro = imputaciones.filter((row) => String(row['id_centro_costo']) === centroId);
      if (byCentro.length === 1) {
        const only = byCentro[0];
        this.form.patchValue({
          id_imputacion_flete: toControlValue(only['id_imputacion_flete']),
          id_cuenta_mayor: toControlValue(only['id_cuenta_mayor']),
        }, { emitEvent: false });
        return;
      }
    }

    this.form.patchValue({ id_imputacion_flete: '' }, { emitEvent: false });
  }

  private _rebuildImputacionIndexes(): void {
    const indexes = this.catalogService.rebuildImputacionIndexes(this.imputacionesFlete);
    this.imputacionesByTipo = indexes.byTipo;
    this.imputacionesById = indexes.byId;
  }

  private _applyTransportFallbacks(): void {
    const empresaHint = fleteToString(this.sapSnapshot?.['sap_empresa_transporte']) || this.flete?.sapEmpresaTransporte || '';
    const choferHint = fleteToString(this.sapSnapshot?.['sap_nombre_chofer']) || fleteToString(this.sapSnapshot?.['Conductor']) || this.flete?.sapNombreChofer || '';
    const patenteHint = fleteToString(this.sapSnapshot?.['sap_patente']) || fleteToString(this.sapSnapshot?.['Patente']) || this.flete?.sapPatente || '';
    const carroHint = fleteToString(this.sapSnapshot?.['sap_carro']) || fleteToString(this.sapSnapshot?.['Carro']) || this.flete?.sapCarro || '';

    if (!this.getControlValue('id_empresa_transporte') && empresaHint) {
      const empresa = this.empresas.find((row) =>
        fleteNormalized(row['sap_codigo']) === fleteNormalized(empresaHint) ||
        fleteNormalized(row['razon_social']) === fleteNormalized(empresaHint) ||
        fleteNormalized(row['rut']) === fleteNormalized(empresaHint)
      );
      if (empresa) {
        this.form.get('id_empresa_transporte')?.setValue(String(empresa['id_empresa']));
      }
    }

    if (!this.getControlValue('id_chofer') && choferHint) {
      const chofer = this.choferes.find((row) =>
        fleteNormalized(row['sap_nombre']) === fleteNormalized(choferHint) ||
        fleteNormalized(row['sap_id_fiscal']) === fleteNormalized(choferHint)
      );
      if (chofer) {
        this.form.get('id_chofer')?.setValue(String(chofer['id_chofer']));
      }
    }

    if (!this.getControlValue('id_camion') && (patenteHint || carroHint)) {
      const camion = this.camiones.find((row) =>
        (patenteHint && fleteNormalized(row['sap_patente']) === fleteNormalized(patenteHint)) ||
        (carroHint && fleteNormalized(row['sap_carro']) === fleteNormalized(carroHint))
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
    const camionTipo = toControlValue(camion?.['id_tipo_camion']);
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
    return toControlValue(selectedCamion?.['id_tipo_camion']);
  }


  private _refreshRouteNodeFilters(clearInvalidDestinoOnOriginChange: boolean): void {
    const result = this.routeResolver.getFilteredNodes({
      rutas: this.rutas,
      tarifas: this.tarifas,
      nodoOptions: this.nodoOptions,
      fechaSalida: this.getControlValue('fecha_salida'),
      tipoCamionId: this._getEffectiveTipoCamionId(),
      selectedOrigen: this.getControlValue('id_origen_nodo'),
      selectedDestino: this.getControlValue('id_destino_nodo'),
      clearInvalidDestino: clearInvalidDestinoOnOriginChange,
    });

    this.origenNodoOptions = result.origenOptions;
    this.destinoNodoOptions = result.destinoOptions;
    this.destinoHintLabel = result.destinoHint;

    if (result.destinoCleared) {
      this.form.patchValue({ id_destino_nodo: '', id_ruta: '', id_tarifa: '' }, { emitEvent: false });
    }
  }

  private _syncRouteAndTarifa(preserveExistingAmount: boolean): void {
    const currentTarifaId = this.getControlValue('id_tarifa');
    const currentMonto = toNullableNumber(this.form.get('monto_aplicado')?.value);

    const resolution = this.routeResolver.resolveRoute({
      rutas: this.rutas,
      tarifas: this.tarifas,
      origenId: this.getControlValue('id_origen_nodo'),
      destinoId: this.getControlValue('id_destino_nodo'),
      explicitRouteId: this.getControlValue('id_ruta'),
      fechaSalida: this.getControlValue('fecha_salida'),
      tipoCamionId: this._getEffectiveTipoCamionId(),
      currentMonto,
      currentExtra: Number(this.form.get('monto_extra')?.value) || 0,
      preserveExistingAmount,
      temporadaLabel: this.currentTemporadaLabel,
    });

    // Construir nombre de ruta según el sentido del usuario (origen → destino del form)
    const origenLabel = this._findNodoLabel(this.getControlValue('id_origen_nodo'));
    const destinoLabel = this._findNodoLabel(this.getControlValue('id_destino_nodo'));
    this.resolvedRouteName = (origenLabel && destinoLabel)
      ? `${origenLabel} → ${destinoLabel}`
      : resolution.routeName;
    this.resolvedRouteDistanceKm = resolution.distanceKm;
    this.resolvedRouteMonto = resolution.monto;
    this.resolvedRouteMoneda = resolution.moneda;
    this.routeResolutionHint = resolution.hint;
    this.resolvedSentido = resolution.sentido;
    this.form.patchValue({ sentido_flete: resolution.sentido || '' }, { emitEvent: false });

    if (!resolution.route) {
      this.form.patchValue({ id_ruta: '', id_tarifa: '' }, { emitEvent: false });
      if (!preserveExistingAmount) {
        this.form.get('monto_aplicado')?.setValue(null);
      }
      return;
    }

    // Backfill: solo setear id_ruta. Los nodos del form reflejan la selección del usuario
    // (pueden estar invertidos respecto a la ruta DB si sentido = VUELTA).
    // Solo backfill nodos si no están seteados (caso id_ruta explícito sin nodos).
    const patchRuta: Record<string, string> = { id_ruta: String(resolution.route['id_ruta']) };
    if (!this.getControlValue('id_origen_nodo') || !this.getControlValue('id_destino_nodo')) {
      if (resolution.sentido === 'VUELTA') {
        patchRuta['id_origen_nodo'] = toControlValue(resolution.route['id_destino_nodo']);
        patchRuta['id_destino_nodo'] = toControlValue(resolution.route['id_origen_nodo']);
      } else {
        patchRuta['id_origen_nodo'] = toControlValue(resolution.route['id_origen_nodo']);
        patchRuta['id_destino_nodo'] = toControlValue(resolution.route['id_destino_nodo']);
      }
    }
    this.form.patchValue(patchRuta, { emitEvent: false });

    if (resolution.tarifa) {
      const newTarifaId = toControlValue(resolution.tarifa['id_tarifa']);
      const tarifaChanged = newTarifaId !== currentTarifaId;
      const extra = Number(this.form.get('monto_extra')?.value) || 0;
      this.form.patchValue({ id_tarifa: newTarifaId }, { emitEvent: false });
      if (!preserveExistingAmount || tarifaChanged) {
        this.form.patchValue({ monto_aplicado: (resolution.monto ?? 0) + extra }, { emitEvent: false });
      }
    } else {
      if (!preserveExistingAmount || !currentTarifaId) {
        this.form.patchValue({ id_tarifa: '' }, { emitEvent: false });
      }
      if (!preserveExistingAmount) {
        this.form.get('monto_aplicado')?.setValue(null);
      }
    }
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
        const value = fleteToString(this.sapSnapshot[key]);
        if (value) cabeceraForm[key] = value;
      }
    }

    const cabecera = cabeceraForm;
    delete cabecera['id_tipo_camion'];
    delete cabecera['id_origen_nodo'];
    delete cabecera['id_destino_nodo'];
    delete cabecera['id_ruta'];

    const grouped = groupDetailRows(this.detailRows());
    const detalles = grouped
      .map((group) => {
        const material = trimOrNull(group.material);
        const descripcion = trimOrNull(group.descripcion);
        const cantidad = group.cantidad_total;
        const unidad = trimOrNull(group.unidad);
        const peso = group.peso_total;
        const idEspecie = group.id_especie || null;

        const hasContent = Boolean(
          idEspecie ||
          material ||
          descripcion ||
          unidad ||
          (Number.isFinite(cantidad) && cantidad !== 0) ||
          (Number.isFinite(peso) && peso !== 0)
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

  private _findNodoLabel(id: string): string {
    if (!id) return '';
    const node = this.nodos.find((row) => String(row['id_nodo']) === id);
    return fleteToString(node?.['nombre']) || '';
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
    const unidad = (fleteToString(row['sap_unidad_peso']) || '').trim();
    const cantidad = toControlValue(row['sap_cantidad_entregada']);

    // En entregas LIPS la cantidad es unidades de envase (bins, totes, etc.),
    // no peso. El peso real solo viene como total en la cabecera (SapPesoTotal).
    // No derivamos peso desde cantidad para evitar mostrar conteos como kilos.
    return {
      ...this._createEmptyDetailRow(),
      material: toControlValue(row['sap_material']),
      descripcion: toControlValue(row['sap_denominacion_material']),
      cantidad,
      unidad: unidad.slice(0, 3) || 'UN',
      peso: '',
      sap_posicion: toControlValue(row['sap_posicion']),
      sap_posicion_superior: toControlValue(row['sap_posicion_superior']),
      sap_lote: toControlValue(row['sap_lote']),
    };
  }

  private _fromRomanaRow(row: Record<string, unknown>): DetalleDraft {
    // Romana: cantidad = envases (CantidadSubEnvaseL), peso = PesoReal
    const especieDesc = fleteToString(row['EspecieDescripcion'] || row['especie_descripcion']);
    const especieCod = fleteToString(row['CodigoEspecie'] || row['codigo_especie']);
    let especieId = '';
    if (especieDesc || especieCod) {
      const match = this.especies.find(
        (e) => (especieDesc && fleteNormalized(e['glosa']) === fleteNormalized(especieDesc))
          || (especieCod && fleteNormalized(e['glosa']) === fleteNormalized(especieCod))
      );
      if (match) especieId = String(match['id_especie']);
    }

    return {
      ...this._createEmptyDetailRow(),
      id_especie: especieId,
      material: fleteToString(row['Material'] || row['material']) ?? '',
      descripcion: fleteToString(row['EspecieDescripcion'] || row['especie_descripcion'] || row['MaterialDescripcion'] || row['material_descripcion']) ?? '',
      cantidad: toControlValue(row['CantidadSubEnvaseL'] ?? row['cantidad_sub_envase_l']),
      unidad: fleteToString(row['UnidadMedida'] || row['unidad_medida']) || 'KG',
      peso: toControlValue(row['PesoReal'] ?? row['peso_real']),
      sap_posicion: fleteToString(row['Posicion'] || row['posicion']) ?? '',
      sap_lote: fleteToString(row['Lote'] || row['lote']) ?? '',
    };
  }

  private _fromExistingRow(row: Record<string, unknown>): DetalleDraft {
    return {
      ...this._createEmptyDetailRow(),
      id_especie: toControlValue(row['id_especie']),
      material: toControlValue(row['material']),
      descripcion: toControlValue(row['descripcion']),
      cantidad: toControlValue(row['cantidad']),
      unidad: toControlValue(row['unidad']),
      peso: toControlValue(row['peso']),
      sap_posicion: toControlValue(row['sap_posicion']),
      sap_posicion_superior: toControlValue(row['sap_posicion_superior']),
      sap_lote: toControlValue(row['sap_lote']),
    };
  }


  // Utilidades movidas a core/utils/flete-form.utils.ts
}
