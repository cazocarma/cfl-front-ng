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
import { TransportEntityPanelComponent } from './transport-entity-panel.component';
import {
  RequirementItem,
  SaveRequirementsSummaryComponent,
} from './save-requirements-summary.component';
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
import {
  CamionDraft,
  ChoferDraft,
  EmpresaTransporteDraft,
  EntityResolution,
  EntityResolutionMode,
  TransportIntent,
  computeDraftDiff,
  emptyCamionDraft,
  emptyChoferDraft,
  emptyEmpresaDraft,
  initialTransportIntent,
  isDraftDirty,
} from './transport-entity-state';
import { isValidChileanRut } from '../../../core/validators/rut.validator';

export { ModalMode } from './edit-flete-modal.types';

@Component({
    selector: 'app-edit-flete-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, SearchableComboboxComponent, DetallesTabComponent, SapSnapshotCardComponent, RouteSummaryCardComponent, TransportEntityPanelComponent, SaveRequirementsSummaryComponent],
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
  /** Contador que bumpea en cada statusChanges del form; lo leen los computeds
   * que dependen del estado de validación para forzar su re-evaluación. */
  private readonly _formStatusVersion = signal(0);
  activeTab = signal<ModalTab>('cabecera');
  loadingCatalogos = signal(false);
  detailLoading = signal(false);
  saving = signal(false);
  // Firma de auditoría: etiqueta "Creado por" lista para pintar. Se rellena al
  // hidratar un flete existente y queda vacía para creaciones.
  createdByLabel = signal('');
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

  // Transporte inteligente: estado paralelo al FormGroup que describe la
  // intencion transaccional por entidad. El FormGroup sigue siendo fuente
  // de verdad para los ids; transportIntent decide que se crea/actualiza.
  transportIntent = signal<TransportIntent>(initialTransportIntent());

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

    // Signal versionado del form. Los computeds que leen .invalid de los controls
    // no son reactivos por sí solos; al bumpear este signal en statusChanges se
    // garantiza que saveRequirements() y firstBlockingReason() se re-evalúen en vivo.
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._formStatusVersion.update((v) => v + 1));
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
    } else if (this.flete?.kind === 'candidato' && this.flete.origenDatos === 'RECEPCION') {
      const ids = this.flete.idsRomanaEntrega ?? [];
      if (ids.length === 0) {
        this.saving.set(false);
        this.errorMsg.set('Candidato Romana sin entregas asociadas.');
        return;
      }
      obs$ = this.cflApi.crearCabeceraDesdeRomana(ids, payload as Record<string, unknown>);
    } else if (this.flete?.kind === 'candidato' && this.flete.idSapEntrega) {
      obs$ = this.cflApi.crearCabeceraDesdeCandidato(this.flete.idSapEntrega, payload);
    } else if (this.flete?.kind === 'en_curso' && this.flete.idCabeceraFlete) {
      obs$ = this.cflApi.updateFleteById(this.flete.idCabeceraFlete, payload);
    } else {
      obs$ = this.cflApi.crearFleteManual(payload);
    }

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        // Si la sección transporte creó/actualizó entidades, invalidar cache de
        // catálogos para que la próxima apertura del modal vea los cambios.
        const intent = this.transportIntent();
        const mutatedCatalogs =
          intent.empresa.mode === 'pending_create' || intent.empresa.mode === 'update' ||
          intent.chofer.mode === 'pending_create' || intent.chofer.mode === 'update' ||
          intent.camion.mode === 'pending_create' || intent.camion.mode === 'update' ||
          (intent.camionTipoChange.changed && intent.camionTipoChange.confirmed);
        if (mutatedCatalogs) {
          this.catalogService.invalidateCache();
        }
        this.guardado.emit();
      },
      error: (err) => {
        this.errorMsg.set(this._formatBackendError(err));
        this.saving.set(false);
      },
    });
  }

  /**
   * Extrae un mensaje humano del error HTTP. Si el backend usa el middleware `validate`
   * (Zod), el body tendrá `{ error: "Error de validación · path: msg", details: [...] }`.
   * En ese caso, concatena los primeros 3 issues para que el usuario vea todas las
   * causas sin tener que abrir la consola.
   */
  private _formatBackendError(err: unknown): string {
    const body = (err as { error?: { error?: unknown; details?: unknown } } | undefined)?.error;
    const topMessage = typeof body?.error === 'string' ? body.error : '';
    const details = Array.isArray(body?.details)
      ? (body.details as Array<{ path?: unknown; message?: unknown }>)
      : [];

    if (details.length > 1) {
      const extras = details
        .slice(1, 4)
        .map((d) => {
          const path = typeof d.path === 'string' ? d.path : '';
          const msg = typeof d.message === 'string' ? d.message : '';
          return path ? `${path}: ${msg}` : msg;
        })
        .filter(Boolean);
      if (extras.length > 0) {
        const more = details.length > 4 ? ` (+${details.length - 4} más)` : '';
        return `${topMessage || 'Error de validación'} — también: ${extras.join('; ')}${more}`;
      }
    }
    return topMessage || 'Error al guardar el flete.';
  }

  private _resetState(): void {
    this.contextVersion += 1;
    this.errorMsg.set('');
    this.detailError.set('');
    this.activeTab.set('cabecera');
    this.sapSnapshot = null;
    this.createdByLabel.set('');
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
      fecha_salida: '',
      hora_salida: '',
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

    if (this.flete?.kind === 'candidato') {
      const isRomana = this.flete.origenDatos === 'RECEPCION';
      if (isRomana) {
        const ids = this.flete.idsRomanaEntrega ?? [];
        if (ids.length === 0) {
          this.detailError.set('Candidato Romana sin entregas asociadas.');
          return;
        }
        this.detailLoading.set(true);
        this.cflApi.getRomanaGrupoDetalle(ids)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              if (!this._isCurrentContext(contextVersion)) return;
              this._hydrateRomanaCandidate(res as any);
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

      if (this.flete.idSapEntrega) {
        this.detailLoading.set(true);
        this.cflApi.getMissingFleteDetalle(this.flete.idSapEntrega)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              if (!this._isCurrentContext(contextVersion)) return;
              this._hydrateCandidate(res as DashboardDetalleResponse);
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
      this.productorOptions.set(
        this.catalogService.mapOptions(this._activeProductores(), 'id_productor', ['codigo_proveedor', 'nombre', 'rut'])
      );
      this._applyProductorFallback();
    });
  }

  private _activeProductores(): Record<string, unknown>[] {
    return this.productores.filter((row) => {
      const activo = row['activo'];
      return activo === undefined || activo === null || activo === true || activo === 1 || activo === '1';
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
    this.productorOptions.set(
      this.catalogService.mapOptions(this._activeProductores(), 'id_productor', ['codigo_proveedor', 'nombre', 'rut'])
    );
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
      fecha_salida: formatDateValue(cabecera['sap_fecha_creacion']) || '',
      hora_salida: formatTimeValue(cabecera['sap_hora_salida']) || '',
    });
    this.detailRows.set(posiciones.map((row) => this._fromSapRow(row)));
    this._applyFallbacks(true);
  }

  private _hydrateRomanaCandidate(response: any): void {
    const cabecera = response.data?.cabecera ?? {};
    const detalles = response.data?.detalles ?? [];
    const grupo = response.data?.grupo ?? {};
    const partidas: Array<{ id_romana_entrega: number; numero_partida: string }> = grupo?.partidas ?? [];

    this.sapSnapshot = cabecera;

    // Regla del negocio: un flete Romana tiene una sola especie. Tomamos el
    // TOP(1) del detalle y resolvemos por CodigoEspecie → IdEspecie.
    const resolvedEspecieId = this._resolveEspecieIdFromCodigo(
      fleteToString((detalles[0] ?? {})['CodigoEspecie'] ?? (detalles[0] ?? {})['codigo_especie']),
    );

    // Para grupos multi-partida, numero_entrega queda vacío (ya no hay una única
    // partida que represente al flete). Si el grupo es de una sola partida, se
    // usa su número de partida para mantener la UX anterior.
    const numeroEntregaHint = partidas.length === 1
      ? (partidas[0].numero_partida || '')
      : '';

    this.form.patchValue({
      numero_entrega: numeroEntregaHint || this.getControlValue('numero_entrega'),
      guia_remision: fleteToString(cabecera['GuiaDespacho'] || cabecera['guia_despacho']) || this.getControlValue('guia_remision'),
      fecha_salida: formatDateValue(cabecera['FechaCreacionSap'] || cabecera['fecha_creacion_sap']) || this.getControlValue('fecha_salida'),
      id_especie: resolvedEspecieId || this.getControlValue('id_especie'),
    });

    this.detailRows.set(detalles.map((row: Record<string, unknown>) => this._fromRomanaRow(row)));
    this._applyFallbacks(true);
  }

  /**
   * Resuelve IdEspecie a partir del CodigoEspecie que viene de RomanaDetalleRaw.
   * Invariante del dominio: cfl.Especie.IdEspecie === Number(CodigoEspecie) sin
   * ceros a la izquierda (ej: '0011' → 11). Si el ID no existe en el mantenedor
   * devuelve '' para que el usuario complete manualmente en el modal.
   */
  private _resolveEspecieIdFromCodigo(codigoEspecie: string | null | undefined): string {
    const raw = String(codigoEspecie ?? '').trim();
    if (!raw) return '';
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return '';
    const exists = this.especies.some((e) => Number(e['id_especie']) === id);
    return exists ? String(id) : '';
  }

  /**
   * Construye la etiqueta de auditoría "Creado por …" desde la cabecera del flete.
   * Preferencia: "Nombre Apellido", luego Username, luego Email. Cadena vacía si
   * el flete no tiene creador registrado (fletes anteriores al fix de auditoría).
   */
  private _buildCreatedByLabel(cabecera: Record<string, unknown>): string {
    const nombre = fleteToString(cabecera['usuario_creador_nombre']) ?? '';
    const apellido = fleteToString(cabecera['usuario_creador_apellido']) ?? '';
    const fullName = [nombre, apellido].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    return fleteToString(cabecera['usuario_creador_username'])
      ?? fleteToString(cabecera['usuario_creador_email'])
      ?? '';
  }

  private _hydrateExisting(response: FleteDetalleResponse): void {
    const cabecera = response.data?.cabecera ?? {};
    const detalles = response.data?.detalles ?? [];

    this.createdByLabel.set(this._buildCreatedByLabel(cabecera));

    // Hints SAP/Romana: se construyen siempre que la cabecera provea alguno. Incluye
    // transporte (sap_empresa_transporte, sap_patente, romana_conductor...) para que
    // `_applyTransportFallbacks` pueda sugerir entidades al usuario cuando el flete
    // se guardó sin IdMovil y la edición debe completarlo.
    const hintKeysSap = [
      'sap_numero_entrega', 'sap_guia_remision', 'sap_destinatario',
      'sap_codigo_tipo_flete', 'sap_centro_costo', 'sap_cuenta_mayor',
      'sap_empresa_transporte', 'sap_nombre_chofer', 'sap_id_fiscal_chofer',
      'sap_patente', 'sap_carro',
    ];
    const hintKeysRomana = ['romana_conductor', 'romana_patente', 'romana_carro'];
    const productorKeys = [
      'id_productor', 'productor_id_resuelto', 'productor_codigo_proveedor',
      'productor_rut', 'productor_nombre', 'productor_email',
    ];
    const snapshot: Record<string, unknown> = {};
    let hasAny = false;
    for (const key of [...hintKeysSap, ...productorKeys]) {
      const value = cabecera[key];
      if (value !== undefined && value !== null && value !== '') {
        snapshot[key] = value;
        hasAny = true;
      }
    }
    // Reexportar hints Romana bajo los alias que consume _applyTransportFallbacks
    // (Conductor, Patente, Carro) para compartir lógica con el flujo de candidato romana.
    const aliasMap: Record<string, string> = {
      romana_conductor: 'Conductor',
      romana_patente: 'Patente',
      romana_carro: 'Carro',
    };
    for (const key of hintKeysRomana) {
      const value = cabecera[key];
      if (value !== undefined && value !== null && value !== '') {
        snapshot[aliasMap[key]] = value;
        hasAny = true;
      }
    }
    this.sapSnapshot = hasAny ? snapshot : null;

    // Si sentido es VUELTA, intercambiar nodos canónicos para que
    // findRouteByNodes detecte correctamente el match reverso.
    const storedSentido = toControlValue(cabecera['sentido_flete']) || '';
    const canonOrigen = toControlValue(cabecera['id_origen_nodo']);
    const canonDestino = toControlValue(cabecera['id_destino_nodo']);
    const formOrigen = storedSentido === 'VUELTA' ? canonDestino : canonOrigen;
    const formDestino = storedSentido === 'VUELTA' ? canonOrigen : canonDestino;

    const dbMonto = cabecera['monto_aplicado'] ?? null;
    const dbMontoExtra = cabecera['monto_extra'] ?? 0;

    // Especie: prioridad 1) CabeceraFlete.IdEspecie si existe,
    // 2) TOP(1) del detalle origen (SAP/Romana current, ya resuelto por backend),
    // 3) vacío para que el usuario complete.
    const cabeceraEspecie = toControlValue(cabecera['id_especie']);
    const detalleEspecie = cabeceraEspecie
      ? cabeceraEspecie
      : toControlValue((detalles[0] ?? {})['id_especie']);

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
      id_especie: detalleEspecie,
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
      fecha_salida: formatDateValue(cabecera['fecha_salida']) || '',
      hora_salida: formatTimeValue(cabecera['hora_salida']) || '',
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
    // Hints vienen de dos fuentes: sapSnapshot (candidato SAP / Romana) y de las
    // columnas expuestas por fetchCabecera en edición. Ambas se normalizan al
    // mismo juego de campos para que el matching quede unificado.
    const empresaHint = fleteToString(this.sapSnapshot?.['sap_empresa_transporte']) || this.flete?.sapEmpresaTransporte || '';
    const choferHintRaw = fleteToString(this.sapSnapshot?.['sap_nombre_chofer']) || fleteToString(this.sapSnapshot?.['Conductor']) || this.flete?.sapNombreChofer || '';
    const choferRutHint = fleteToString(this.sapSnapshot?.['sap_id_fiscal_chofer']) || '';
    const patenteHint = fleteToString(this.sapSnapshot?.['sap_patente']) || fleteToString(this.sapSnapshot?.['Patente']) || this.flete?.sapPatente || '';
    const carroHint = fleteToString(this.sapSnapshot?.['sap_carro']) || fleteToString(this.sapSnapshot?.['Carro']) || this.flete?.sapCarro || '';

    // === Empresa ===
    // 1) Prioridad al id ya seteado en el form (viene del JOIN cfl.Movil en edición
    //    o de una selección previa del usuario). Es la fuente autoritativa.
    const formIdEmpresa = this.getControlValue('id_empresa_transporte');
    let empresaRow: Record<string, unknown> | null = formIdEmpresa
      ? this.empresas.find((row) => String(row['id_empresa']) === formIdEmpresa) || null
      : null;
    // 2) Fallback: match por hint SAP/Romana.
    if (!empresaRow && empresaHint) {
      empresaRow = this.empresas.find((row) =>
        fleteNormalized(row['sap_codigo']) === fleteNormalized(empresaHint) ||
        fleteNormalized(row['razon_social']) === fleteNormalized(empresaHint) ||
        fleteNormalized(row['rut']) === fleteNormalized(empresaHint)
      ) || null;
      if (empresaRow) this.form.get('id_empresa_transporte')?.setValue(String(empresaRow['id_empresa']));
    }
    const empresaRes = this._buildEmpresaResolution(empresaRow, empresaHint);
    this._updateIntent((intent) => ({ ...intent, empresa: empresaRes }));

    // === Chofer ===
    // Parsear RUT desde texto libre (conductor romana viene como "12.345.678-9 NOMBRE")
    const rutMatch = (choferRutHint || choferHintRaw).match(/\b(\d{1,2}(?:[.\s]?\d{3}){2}-?[\dkK]|\d{7,8}-?[\dkK])\b/);
    const choferRutCandidate = rutMatch ? rutMatch[1] : (choferRutHint || '');
    const choferNombreCandidate = choferHintRaw.replace(choferRutCandidate || '', '').replace(/[|,;/()]+/g, ' ').replace(/\s+/g, ' ').trim() || choferHintRaw;
    const choferHintCombined = [choferRutCandidate, choferNombreCandidate].filter(Boolean).join(' · ');
    const formIdChofer = this.getControlValue('id_chofer');
    let choferRow: Record<string, unknown> | null = formIdChofer
      ? this.choferes.find((row) => String(row['id_chofer']) === formIdChofer) || null
      : null;
    if (!choferRow && (choferHintRaw || choferRutCandidate)) {
      choferRow = this.choferes.find((row) =>
        (choferRutCandidate && fleteNormalized(row['sap_id_fiscal']) === fleteNormalized(choferRutCandidate)) ||
        (choferHintRaw && fleteNormalized(row['sap_nombre']) === fleteNormalized(choferHintRaw))
      ) || null;
      if (choferRow) this.form.get('id_chofer')?.setValue(String(choferRow['id_chofer']));
    }
    const choferRes = this._buildChoferResolution(choferRow, choferHintCombined, choferRutCandidate, choferNombreCandidate);
    this._updateIntent((intent) => ({ ...intent, chofer: choferRes }));

    // === Camion ===
    const formIdCamion = this.getControlValue('id_camion');
    let camionRow: Record<string, unknown> | null = formIdCamion
      ? this.camiones.find((row) => String(row['id_camion']) === formIdCamion) || null
      : null;
    if (!camionRow && (patenteHint || carroHint)) {
      camionRow = this.camiones.find((row) =>
        (patenteHint && fleteNormalized(row['sap_patente']) === fleteNormalized(patenteHint)) ||
        (carroHint && fleteNormalized(row['sap_carro']) === fleteNormalized(carroHint))
      ) || null;
      if (camionRow) this.form.get('id_camion')?.setValue(String(camionRow['id_camion']));
    }
    const hintCamion = [patenteHint, carroHint].filter(Boolean).join(' / ');
    const camionRes = this._buildCamionResolution(camionRow, hintCamion, patenteHint, carroHint);
    this._updateIntent((intent) => ({ ...intent, camion: camionRes }));
  }

  private _updateIntent(mutator: (intent: TransportIntent) => TransportIntent): void {
    this.transportIntent.update(mutator);
  }

  private _buildEmpresaResolution(row: Record<string, unknown> | null, hint: string): EntityResolution<EmpresaTransporteDraft> {
    if (row) {
      const draft: EmpresaTransporteDraft = {
        sap_codigo: fleteToString(row['sap_codigo']) || null,
        rut: fleteToString(row['rut']) || null,
        razon_social: fleteToString(row['razon_social']) || null,
        nombre_representante: fleteToString(row['nombre_representante']) || null,
        correo: fleteToString(row['correo']) || null,
        telefono: fleteToString(row['telefono']) || null,
        activo: row['activo'] !== 0 && row['activo'] !== false,
      };
      return {
        mode: 'matched',
        existingId: Number(row['id_empresa']),
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    if (hint) {
      const draft = emptyEmpresaDraft();
      // intentar inferir razon social del hint
      draft.razon_social = hint;
      return {
        mode: 'pending_create',
        existingId: null,
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    return { mode: 'empty', existingId: null, draft: emptyEmpresaDraft(), pristine: emptyEmpresaDraft(), hint: '' };
  }

  private _buildChoferResolution(row: Record<string, unknown> | null, hint: string, rutFromHint: string, nombreFromHint: string): EntityResolution<ChoferDraft> {
    if (row) {
      const draft: ChoferDraft = {
        sap_id_fiscal: fleteToString(row['sap_id_fiscal']) || null,
        sap_nombre: fleteToString(row['sap_nombre']) || null,
        telefono: fleteToString(row['telefono']) || null,
        activo: row['activo'] !== 0 && row['activo'] !== false,
      };
      return {
        mode: 'matched',
        existingId: Number(row['id_chofer']),
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    if (hint && (rutFromHint || nombreFromHint)) {
      const draft: ChoferDraft = {
        sap_id_fiscal: rutFromHint || null,
        sap_nombre: nombreFromHint || null,
        telefono: null,
        activo: true,
      };
      return {
        mode: 'pending_create',
        existingId: null,
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    return { mode: 'empty', existingId: null, draft: emptyChoferDraft(), pristine: emptyChoferDraft(), hint: '' };
  }

  private _buildCamionResolution(row: Record<string, unknown> | null, hint: string, patenteHint: string, carroHint: string): EntityResolution<CamionDraft> {
    if (row) {
      const draft: CamionDraft = {
        sap_patente: fleteToString(row['sap_patente']) || null,
        sap_carro: fleteToString(row['sap_carro']) || null,
        id_tipo_camion: row['id_tipo_camion'] ? Number(row['id_tipo_camion']) : null,
        activo: row['activo'] !== 0 && row['activo'] !== false,
      };
      return {
        mode: 'matched',
        existingId: Number(row['id_camion']),
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    if (patenteHint) {
      const draft: CamionDraft = {
        sap_patente: patenteHint.toUpperCase(),
        sap_carro: carroHint ? carroHint.toUpperCase() : null,
        id_tipo_camion: null, // el usuario debe elegir
        activo: true,
      };
      return {
        mode: 'pending_create',
        existingId: null,
        draft,
        pristine: { ...draft },
        hint,
      };
    }
    return { mode: 'empty', existingId: null, draft: emptyCamionDraft(), pristine: emptyCamionDraft(), hint: '' };
  }

  // ── Handlers del componente TransportEntityPanel ─────────────────────

  onTransportPanelSelectExisting(entityKey: 'empresa' | 'chofer' | 'camion', id: number | null): void {
    const formField = entityKey === 'empresa' ? 'id_empresa_transporte' : entityKey === 'chofer' ? 'id_chofer' : 'id_camion';
    this.form.get(formField)?.setValue(id ? String(id) : '');

    if (!id) {
      // Limpiar resolution a empty
      this._updateIntent((intent) => {
        if (entityKey === 'empresa') return { ...intent, empresa: this._buildEmpresaResolution(null, '') };
        if (entityKey === 'chofer') return { ...intent, chofer: this._buildChoferResolution(null, '', '', '') };
        return { ...intent, camion: this._buildCamionResolution(null, '', '', '') };
      });
      if (entityKey === 'camion') {
        // Al limpiar camión, también limpiamos tipo derivado y recalculamos
        // tarifa (la ruta puede quedar sin tarifa por falta de tipo).
        this.form.get('id_tipo_camion')?.setValue('');
        this._refreshRouteNodeFilters(false);
        this._syncRouteAndTarifa(true);
      }
      return;
    }

    // Elegir registro del combobox
    const listLookup = entityKey === 'empresa' ? this.empresas : entityKey === 'chofer' ? this.choferes : this.camiones;
    const idField = entityKey === 'empresa' ? 'id_empresa' : entityKey === 'chofer' ? 'id_chofer' : 'id_camion';
    const row = listLookup.find((r) => String(r[idField]) === String(id)) || null;
    this._updateIntent((intent) => {
      if (entityKey === 'empresa') return { ...intent, empresa: this._buildEmpresaResolution(row, intent.empresa.hint) };
      if (entityKey === 'chofer') return { ...intent, chofer: this._buildChoferResolution(row, intent.chofer.hint, '', '') };
      return { ...intent, camion: this._buildCamionResolution(row, intent.camion.hint, '', '') };
    });

    if (entityKey === 'camion') {
      // Sincroniza id_tipo_camion desde el camión elegido y recalcula la ruta/
      // tarifa. Equivalente a lo que hacía setControlValue('id_camion', ...)
      // en el flujo legacy (edit-flete-modal.component.ts:456-462).
      this._syncTipoCamionFromCamion(String(id));
      this._refreshRouteNodeFilters(false);
      this._syncRouteAndTarifa(true);
    }
  }

  onTransportPanelDraftField(entityKey: 'empresa' | 'chofer' | 'camion', payload: { field: string; value: unknown }): void {
    this._updateIntent((intent) => {
      // Cast a unknown primero para evitar checks estrictos entre union types y Record.
      const current = intent[entityKey] as unknown as EntityResolution<Record<string, unknown>>;
      const currentDraftRec = current.draft;
      const pristineRec = current.pristine;
      const nextDraftRec: Record<string, unknown> = { ...currentDraftRec };
      const value = payload.value === '' ? null : payload.value;
      nextDraftRec[payload.field] = value;
      const isDirty = isDraftDirty(nextDraftRec, pristineRec);
      let nextMode: EntityResolutionMode = current.mode;
      if (current.mode === 'matched' && isDirty) nextMode = 'update';
      else if (current.mode === 'update' && !isDirty) nextMode = 'matched';
      // pending_create mantiene su modo mientras el user edita.
      const nextResolution: EntityResolution<Record<string, unknown>> = {
        ...current,
        draft: nextDraftRec,
        mode: nextMode,
      };
      return { ...intent, [entityKey]: nextResolution } as unknown as TransportIntent;
    });
  }

  onCamionPanelTipoChange(newTipoId: number | null): void {
    // Si mode=pending_create, el id_tipo_camion es parte del draft.
    // Si mode=matched/update sobre un camion existente, es un cambio al mantenedor.
    this._updateIntent((intent) => {
      const camion = intent.camion;
      const camionDraft: CamionDraft = { ...camion.draft, id_tipo_camion: newTipoId };
      const newCamion: EntityResolution<CamionDraft> = { ...camion, draft: camionDraft };
      let tipoChange = intent.camionTipoChange;
      if (camion.mode === 'matched' || camion.mode === 'update') {
        const original = camion.pristine.id_tipo_camion || null;
        const changed = (original || null) !== (newTipoId || null);
        tipoChange = {
          changed,
          originalIdTipoCamion: original,
          newIdTipoCamion: newTipoId,
          confirmed: changed ? tipoChange.confirmed : false,
        };
      }
      return { ...intent, camion: newCamion, camionTipoChange: tipoChange };
    });
    // El form.id_tipo_camion se mantiene para la UI (no se envia al backend en cabecera).
    this.form.get('id_tipo_camion')?.setValue(newTipoId ? String(newTipoId) : '');
    this._syncRouteAndTarifa(false);
  }

  onCamionTipoConfirmChange(confirmed: boolean): void {
    this._updateIntent((intent) => ({
      ...intent,
      camionTipoChange: { ...intent.camionTipoChange, confirmed },
    }));
  }

  /** Resume para UI: cuántas entidades se crearán/actualizarán. */
  transportPendingSummary = computed<{ creates: number; updates: number; tipoCamion: boolean }>(() => {
    const intent = this.transportIntent();
    const creates = ['empresa', 'chofer', 'camion'].filter((k) => intent[k as 'empresa' | 'chofer' | 'camion'].mode === 'pending_create').length;
    const updates = ['empresa', 'chofer', 'camion'].filter((k) => intent[k as 'empresa' | 'chofer' | 'camion'].mode === 'update').length;
    return { creates, updates, tipoCamion: intent.camionTipoChange.changed && intent.camionTipoChange.confirmed };
  });

  /** Indica si la sección transporte está lista para guardar (tipo camion sin confirmar bloquea). */
  canSaveTransport = computed<boolean>(() => {
    const intent = this.transportIntent();
    if (intent.camionTipoChange.changed && !intent.camionTipoChange.confirmed) return false;
    return true;
  });

  /**
   * Lista de requisitos que el usuario necesita completar antes de poder guardar.
   * Alimenta al componente `save-requirements-summary` visible junto al botón Guardar
   * y al tooltip del propio botón (vía `firstBlockingReason`).
   */
  saveRequirements = computed<RequirementItem[]>(() => {
    // Leer el signal hace que el computed se re-evalúe en cada statusChanges.
    this._formStatusVersion();

    const items: RequirementItem[] = [];
    // Si el flete es readonly o el form aún está hidratando, no tiene sentido mostrar
    // faltantes (serían falsos positivos sobre datos no cargados).
    if (this.isReadOnly() || this.loadingCatalogos() || this.detailLoading()) {
      return items;
    }

    const required: Array<[string, string]> = [
      ['guia_remision', 'N° de guía'],
      ['fecha_salida', 'Fecha de salida'],
      ['hora_salida', 'Hora de salida'],
      ['tipo_movimiento', 'Tipo de movimiento'],
      ['id_tipo_flete', 'Tipo de flete'],
      ['id_centro_costo', 'Centro de costo'],
    ];
    for (const [key, label] of required) {
      const ctrl = this.form.get(key);
      items.push({
        id: `form:${key}`,
        label,
        done: !ctrl || !ctrl.invalid,
        severity: 'error',
      });
    }

    const intent = this.transportIntent();
    const needsRut = (mode: EntityResolutionMode): boolean => mode === 'pending_create' || mode === 'update';

    // RUT empresa: solo advertencia (severity='warn'). No bloquea el guardado —
    // el backend lo normaliza y, si no coincide con DV, queda registrado tal cual
    // viene del hint SAP. El usuario puede corregir pero no se lo obligamos.
    if (needsRut(intent.empresa.mode)) {
      const rut = intent.empresa.draft.rut ?? '';
      const valid = !rut || isValidChileanRut(rut);
      items.push({
        id: 'rut:empresa',
        label: valid ? 'RUT de empresa' : 'RUT de empresa no supera validación (opcional)',
        done: valid,
        severity: 'warn',
        hint: valid ? undefined : 'Revisa el dígito verificador. Puedes guardar igual.',
      });
    }
    // RUT chofer: también warn — mismo criterio, es hint SAP/Romana.
    if (needsRut(intent.chofer.mode)) {
      const rut = intent.chofer.draft.sap_id_fiscal ?? '';
      const valid = !rut || isValidChileanRut(rut);
      items.push({
        id: 'rut:chofer',
        label: valid ? 'RUT de chofer' : 'RUT de chofer no supera validación (opcional)',
        done: valid,
        severity: 'warn',
        hint: valid ? undefined : 'Revisa el dígito verificador. Puedes guardar igual.',
      });
    }

    if (intent.camionTipoChange.changed) {
      items.push({
        id: 'camion:tipo_confirm',
        label: 'Confirmar cambio de tipo de camión',
        done: intent.camionTipoChange.confirmed,
        severity: 'error',
        hint: 'Esto actualizará el camión en el mantenedor y afectará futuros fletes.',
        action: { kind: 'checkbox', checked: intent.camionTipoChange.confirmed },
      });
    }

    return items;
  });

  /**
   * Primera razón por la que el botón Guardar está deshabilitado. Se usa como tooltip
   * dinámico: "Falta: <label>". Devuelve null si no hay nada bloqueando.
   */
  firstBlockingReason = computed<string | null>(() => {
    const blocker = this.saveRequirements().find((i) => !i.done && i.severity === 'error');
    return blocker ? blocker.label : null;
  });

  /**
   * Maneja acciones inline del summary (por ahora: confirmar cambio de tipo-camión).
   * Reutiliza `onCamionTipoConfirmChange` para mantener una sola fuente de verdad.
   */
  onSaveSummaryAction(event: { id: string; kind: 'checkbox'; checked: boolean }): void {
    if (event.id === 'camion:tipo_confirm') {
      this.onCamionTipoConfirmChange(event.checked);
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


  private _buildPayload(): { cabecera: Record<string, unknown>; detalles: Record<string, unknown>[]; transport: Record<string, unknown> | null } {
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

    const idRutaForContext = cabeceraForm['id_ruta'];

    const cabecera = cabeceraForm;
    delete cabecera['id_tipo_camion'];
    delete cabecera['id_origen_nodo'];
    delete cabecera['id_destino_nodo'];
    delete cabecera['id_ruta'];

    // Para candidatos Romana (multi-partida) preservamos la granularidad por
    // posición: cada fila del DetalleDraft se persiste como un DetalleFlete con
    // sus campos de trazabilidad (IdRomanaEntrega, NumeroPartida, Posicion, Lote)
    // — eso sobrevive a borrados/actualizaciones en las vistas Romana. Para SAP
    // y edición post-creación se mantiene la agrupación por material.
    const isRomanaCandidate = this.flete?.kind === 'candidato' && this.flete.origenDatos === 'RECEPCION';

    const detalles: Record<string, unknown>[] = isRomanaCandidate
      ? this._buildRomanaDetallesPayload()
      : this._buildGroupedDetallesPayload();

    const transport = this._buildTransportPayload(idRutaForContext);

    return { cabecera, detalles, transport };
  }

  private _buildGroupedDetallesPayload(): Record<string, unknown>[] {
    const grouped = groupDetailRows(this.detailRows());
    return grouped
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
  }

  private _buildRomanaDetallesPayload(): Record<string, unknown>[] {
    return this.detailRows()
      .map((row) => {
        const material = trimOrNull(row.material);
        const descripcion = trimOrNull(row.descripcion);
        const cantidadNum = Number(row.cantidad);
        const pesoNum = Number(row.peso);
        const unidad = trimOrNull(row.unidad);
        const idEspecie = row.id_especie || null;
        const idRomanaEntregaNum = Number(row.id_romana_entrega);
        const numeroPartida = trimOrNull(row.romana_numero_partida);
        const sapPosicion = trimOrNull(row.sap_posicion);
        const sapLote = trimOrNull(row.sap_lote);

        const hasContent = Boolean(
          idEspecie ||
          material ||
          descripcion ||
          unidad ||
          (Number.isFinite(cantidadNum) && cantidadNum !== 0) ||
          (Number.isFinite(pesoNum) && pesoNum !== 0)
        );
        if (!hasContent) return null;

        return {
          id_especie: idEspecie,
          material,
          descripcion,
          cantidad: Number.isFinite(cantidadNum) ? cantidadNum : null,
          unidad: unidad ? unidad.slice(0, 3) : null,
          peso: Number.isFinite(pesoNum) ? pesoNum : null,
          id_romana_entrega: Number.isFinite(idRomanaEntregaNum) && idRomanaEntregaNum > 0
            ? idRomanaEntregaNum
            : null,
          numero_partida: numeroPartida,
          sap_posicion: sapPosicion,
          sap_lote: sapLote,
        };
      })
      .filter((row) => row !== null) as Record<string, unknown>[];
  }

  /** Convierte el signal transportIntent al shape que espera el backend. */
  private _buildTransportPayload(idRutaForContext: unknown): Record<string, unknown> | null {
    const intent = this.transportIntent();
    const empresaBlock = this._buildEmpresaIntentBlock(intent.empresa);
    const choferBlock = this._buildChoferIntentBlock(intent.chofer);
    const camionBlock = this._buildCamionIntentBlock(intent.camion, intent.camionTipoChange);

    // Si los 3 modos son empty y no hay camionTipoChange, no mandamos la sección.
    const hasAny = empresaBlock || choferBlock || camionBlock;
    if (!hasAny && !intent.recalcTarifa) return null;

    const payload: Record<string, unknown> = {};
    if (empresaBlock) payload['empresa'] = empresaBlock;
    if (choferBlock) payload['chofer'] = choferBlock;
    if (camionBlock) payload['camion'] = camionBlock;
    payload['recalc_tarifa'] = Boolean(intent.recalcTarifa || (intent.camionTipoChange.changed && intent.camionTipoChange.confirmed));
    const idRutaNum = idRutaForContext ? Number(idRutaForContext) : null;
    const fecha = this.form.get('fecha_salida')?.value || intent.routeContext.fechaSalida;
    payload['route_context'] = {
      id_ruta: Number.isFinite(idRutaNum) && idRutaNum ? idRutaNum : null,
      fecha_salida: fecha || null,
    };
    return payload;
  }

  private _buildEmpresaIntentBlock(res: EntityResolution<EmpresaTransporteDraft>): Record<string, unknown> | null {
    if (res.mode === 'empty') return null;
    if (res.mode === 'pending_create') {
      // Zod exige `rut` min(1) para crear empresa. Sin RUT, omitimos el bloque
      // y dejamos que el flete se guarde sin empresa (IdMovil quedará null
      // hasta que el usuario complete los datos).
      if (!trimOrNull(res.draft.rut)) return null;
      return { mode: 'pending_create', pending_create: { ...res.draft } };
    }
    if (res.mode === 'update' && res.existingId) {
      const diff = computeDraftDiff(res.draft, res.pristine);
      if (Object.keys(diff).length === 0) return { mode: 'matched' };
      return { mode: 'update', update: { id_empresa_transporte: res.existingId, fields: diff } };
    }
    // mode === 'matched' (o update sin existingId, imposible en la práctica)
    return { mode: 'matched' };
  }

  private _buildChoferIntentBlock(res: EntityResolution<ChoferDraft>): Record<string, unknown> | null {
    if (res.mode === 'empty') return null;
    if (res.mode === 'pending_create') {
      // Zod exige `sap_id_fiscal` y `sap_nombre`. Sin alguno, omitimos el bloque.
      if (!trimOrNull(res.draft.sap_id_fiscal) || !trimOrNull(res.draft.sap_nombre)) return null;
      return { mode: 'pending_create', pending_create: { ...res.draft } };
    }
    if (res.mode === 'update' && res.existingId) {
      const diff = computeDraftDiff(res.draft, res.pristine);
      if (Object.keys(diff).length === 0) return { mode: 'matched' };
      return { mode: 'update', update: { id_chofer: res.existingId, fields: diff } };
    }
    return { mode: 'matched' };
  }

  private _buildCamionIntentBlock(res: EntityResolution<CamionDraft>, tipoChange: TransportIntent['camionTipoChange']): Record<string, unknown> | null {
    const hasTipoUpdate = tipoChange.changed && tipoChange.confirmed && !!res.existingId;
    if (res.mode === 'empty' && !hasTipoUpdate) return null;

    let block: Record<string, unknown> | null;
    if (res.mode === 'pending_create') {
      // Zod exige `sap_patente` + `id_tipo_camion`. Sin ellos, omitimos el bloque.
      if (!trimOrNull(res.draft.sap_patente) || !res.draft.id_tipo_camion) {
        block = null;
      } else {
        block = { mode: 'pending_create', pending_create: { ...res.draft } };
      }
    } else if (res.mode === 'update' && res.existingId) {
      const diff = computeDraftDiff(res.draft, res.pristine);
      block = Object.keys(diff).length === 0
        ? { mode: 'matched' }
        : { mode: 'update', update: { id_camion: res.existingId, fields: diff } };
    } else if (res.mode === 'matched') {
      block = { mode: 'matched' };
    } else {
      // empty con hasTipoUpdate: emitir bloque mínimo para transportar update_tipo_camion.
      block = { mode: 'empty' };
    }

    if (hasTipoUpdate) {
      block = block ?? { mode: 'empty' };
      block['update_tipo_camion'] = {
        id_camion: res.existingId,
        from_id_tipo_camion: tipoChange.originalIdTipoCamion,
        to_id_tipo_camion: tipoChange.newIdTipoCamion,
      };
    }
    return block;
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
      id_romana_entrega: '',
      romana_numero_partida: '',
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
    // Romana: cantidad = envases (CantidadSubEnvaseL), peso = PesoReal.
    // IdEspecie se deriva directo del CodigoEspecie (sin ceros a la izquierda).
    const especieId = this._resolveEspecieIdFromCodigo(
      fleteToString(row['CodigoEspecie'] ?? row['codigo_especie']),
    );

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
      id_romana_entrega: toControlValue(row['IdRomanaEntrega'] ?? row['id_romana_entrega']),
      romana_numero_partida: fleteToString(row['NumeroPartida'] || row['numero_partida']) ?? '',
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
