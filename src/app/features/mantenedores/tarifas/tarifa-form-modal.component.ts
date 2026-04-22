import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { toLocalDateInput } from '../../../core/utils/format.utils';
import { MantenedorConfig } from '../mantenedor.config';

interface NodoOpt { id_nodo: number; nombre: string; }
interface RutaOpt { id_ruta: number; nombre_ruta: string; id_origen_nodo: number; id_destino_nodo: number; activo?: boolean; }
interface TipoCamionOpt { id_tipo_camion: number; nombre: string; }
interface TemporadaOpt {
  id_temporada: number;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}
interface TarifaRow { id_tarifa: number; id_tipo_camion: number; id_temporada: number; id_ruta: number; }
type DropdownKey = 'temporada' | 'tipo_camion' | 'origen' | 'destino' | 'ruta';
type DropdownStyle = Record<string, string>;

const MONEDAS = [
  { value: 'CLP', label: 'CLP - Peso chileno' },
  { value: 'USD', label: 'USD - Dolar' },
];

@Component({
  selector: 'app-tarifa-form-modal',
  imports: [ReactiveFormsModule, NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
             (scroll)="onModalScroll()"
             (click)="$event.stopPropagation()">
          <!-- Header estándar (consistente con usuario-form-modal y genérico) -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <div>
              <h2 class="text-lg font-bold text-white">
                {{ row ? 'Editar' : 'Nueva' }} Tarifa
              </h2>
              <p class="text-xs text-green-200 mt-0.5">
                {{ row ? 'Modifica los campos necesarios' : 'Completa los campos requeridos (*)' }}
              </p>
            </div>
            <button type="button" (click)="cerrado.emit()" class="text-white/70 hover:text-white transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="px-6 py-5">
            @if (loading()) {
              <p class="text-sm text-forest-600">Cargando catalogos...</p>
            } @else {
              <!-- ID Tarifa: editable al crear (vacío → autoasignar IDENTITY), readonly al editar -->
              <div class="mb-4">
                <label class="block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5">ID Tarifa</label>
                @if (row) {
                  <input type="text" class="cfl-input font-mono bg-forest-50 cursor-not-allowed"
                         [value]="$any(row)['id_tarifa'] ?? $any(row)['IdTarifa'] ?? ''" readonly
                         title="El ID no se puede modificar en registros existentes" />
                } @else {
                  <input type="number" class="cfl-input font-mono"
                         [formControl]="idInputControl"
                         placeholder="Se asignará al guardar si lo dejas vacío"
                         min="1" />
                }
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label class="block text-xs font-semibold mb-1.5">Temporada *</label>
                  <div class="relative">
                    <input class="cfl-input pr-8" [class.border-red-400]="submitted && !selectedTemporadaId()"
                           [value]="searchTemporada()" placeholder="Buscar temporada..."
                           (input)="searchTemporada.set($any($event.target).value)"
                           (focus)="openDropdown(openTemporada, 'temporada', $event)" (blur)="closeWithDelay(openTemporada)" />
                    @if (openTemporada()) {
                      <div class="fixed z-[70] overflow-y-auto border rounded-lg bg-white shadow"
                           [ngStyle]="getDropdownStyle('temporada')"
                           (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                        @for (t of filteredTemporadas(); track t.id_temporada) {
                          <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                  (mousedown)="selectTemporada(t)">{{ t.codigo }} - {{ t.nombre }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold mb-1.5">Tipo de Camion *</label>
                  <div class="relative">
                    <input class="cfl-input pr-8" [class.border-red-400]="submitted && !selectedTipoCamionId()"
                           [value]="searchTipoCamion()" placeholder="Buscar tipo..."
                           (input)="searchTipoCamion.set($any($event.target).value)"
                           (focus)="openDropdown(openTipoCamion, 'tipo_camion', $event)" (blur)="closeWithDelay(openTipoCamion)" />
                    @if (openTipoCamion()) {
                      <div class="fixed z-[70] overflow-y-auto border rounded-lg bg-white shadow"
                           [ngStyle]="getDropdownStyle('tipo_camion')"
                           (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                        @for (tc of filteredTiposCamion(); track tc.id_tipo_camion) {
                          <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                  (mousedown)="selectTipoCamion(tc)">{{ tc.nombre }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>

              <section class="mb-5">
                <h3 class="text-xs font-bold uppercase text-forest-600 mb-2">Ruta</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold mb-1.5">Nodo Origen *</label>
                    <div class="relative">
                      <input class="cfl-input" [value]="searchOrigen()" placeholder="Buscar nodo..."
                             (input)="searchOrigen.set($any($event.target).value)"
                             (focus)="openDropdown(openOrigen, 'origen', $event)" (blur)="closeWithDelay(openOrigen)" />
                      @if (openOrigen()) {
                        <div class="fixed z-[70] overflow-y-auto border rounded-lg bg-white shadow"
                             [ngStyle]="getDropdownStyle('origen')"
                             (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                          @for (n of filteredOrigen(); track n.id_nodo) {
                            <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                    (mousedown)="selectOrigen(n)">{{ n.nombre }}</button>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold mb-1.5">Nodo Destino *</label>
                    <div class="relative">
                      <input class="cfl-input" [value]="searchDestino()" placeholder="Buscar nodo..."
                             (input)="searchDestino.set($any($event.target).value)"
                             (focus)="openDropdown(openDestino, 'destino', $event)" (blur)="closeWithDelay(openDestino)" />
                      @if (openDestino()) {
                        <div class="fixed z-[70] overflow-y-auto border rounded-lg bg-white shadow"
                             [ngStyle]="getDropdownStyle('destino')"
                             (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                          @for (n of filteredDestino(); track n.id_nodo) {
                            <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                    (mousedown)="selectDestino(n)">{{ n.nombre }}</button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>

                @if (selectedOrigenId() && selectedDestinoId()) {
                  <div class="mt-3">
                    @if (rutaAutoDetectada()) {
                      <p class="text-xs text-emerald-700">Ruta encontrada: <strong>{{ rutaAutoDetectada()!.nombre_ruta }}</strong></p>
                    } @else if (rutasDisponibles().length > 1) {
                      <div class="relative mt-2">
                        <input class="cfl-input" [value]="searchRuta()" placeholder="Seleccionar ruta..."
                               (input)="searchRuta.set($any($event.target).value)"
                               (focus)="openDropdown(openRuta, 'ruta', $event)" (blur)="closeWithDelay(openRuta)" />
                        @if (openRuta()) {
                          <div class="fixed z-[70] overflow-y-auto border rounded-lg bg-white shadow"
                               [ngStyle]="getDropdownStyle('ruta')"
                               (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                            @for (r of filteredRutas(); track r.id_ruta) {
                              <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                      (mousedown)="selectRuta(r)">{{ r.nombre_ruta }}</button>
                            }
                          </div>
                        }
                      </div>
                    } @else {
                      <p class="text-xs text-slate-600">
                        No existe ruta entre estos nodos.
                        <a class="text-forest-600 underline cursor-pointer" (click)="goToRutasCreate()">Crea la ruta primero.</a>
                      </p>
                    }
                  </div>
                }
              </section>

              @if (tarifaDuplicada()) {
                <div class="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  Ya existe una tarifa para esa combinacion (temporada + tipo camion + ruta).
                </div>
              }

              @if (efectiveRutaId()) {
                <form [formGroup]="form" (ngSubmit)="onGuardar()">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label class="block text-xs font-semibold mb-1.5">Vigencia Desde *</label><input type="date" class="cfl-input" formControlName="vigencia_desde" /></div>
                    <div><label class="block text-xs font-semibold mb-1.5">Vigencia Hasta</label><input type="date" class="cfl-input" formControlName="vigencia_hasta" /></div>
                    <div>
                      <label class="block text-xs font-semibold mb-1.5">Moneda *</label>
                      <select class="cfl-select" formControlName="moneda">
                        <option value="">Seleccionar...</option>
                        @for (m of monedas; track m.value) { <option [value]="m.value">{{ m.label }}</option> }
                      </select>
                    </div>
                    <div><label class="block text-xs font-semibold mb-1.5">Monto Fijo *</label><input type="number" class="cfl-input" min="0" formControlName="monto_fijo" /></div>
                  </div>

                  @if (errorMsg()) {
                    <div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{{ errorMsg() }}</div>
                  }

                  <div class="mt-5 flex justify-end gap-3">
                    <button type="button" class="btn-secondary" (click)="cerrado.emit()">Cancelar</button>
                    <button type="submit" class="btn-primary" [disabled]="saving() || loading() || (!!tarifaDuplicada() && !row)">
                      {{ saving() ? 'Guardando...' : (row ? 'Guardar cambios' : 'Crear tarifa') }}
                    </button>
                  </div>
                </form>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TarifaFormModalComponent implements OnChanges {
  private destroyRef = inject(DestroyRef);

  @Input() config!: MantenedorConfig;
  @Input() row: Record<string, unknown> | null = null;
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado = new EventEmitter<void>();

  nodos = signal<NodoOpt[]>([]);
  rutas = signal<RutaOpt[]>([]);
  tiposCamion = signal<TipoCamionOpt[]>([]);
  temporadas = signal<TemporadaOpt[]>([]);
  tarifasTemporada = signal<TarifaRow[]>([]);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal('');
  submitted = false;

  readonly monedas = MONEDAS;

  selectedTemporadaId = signal<number | null>(null);
  selectedOrigenId = signal<number | null>(null);
  selectedDestinoId = signal<number | null>(null);
  selectedRutaId = signal<number | null>(null);
  selectedTipoCamionId = signal<number | null>(null);

  searchTemporada = signal('');
  searchOrigen = signal('');
  searchDestino = signal('');
  searchRuta = signal('');
  searchTipoCamion = signal('');

  openTemporada = signal(false);
  openOrigen = signal(false);
  openDestino = signal(false);
  openRuta = signal(false);
  openTipoCamion = signal(false);

  filteredTemporadas = computed(() => this._filter(this.temporadas(), this.searchTemporada(), (t) => `${t.codigo} ${t.nombre}`));
  filteredOrigen = computed(() => this._filter(this.nodos(), this.searchOrigen(), (n) => n.nombre));
  filteredDestino = computed(() => this._filter(this.nodos(), this.searchDestino(), (n) => n.nombre));
  filteredTiposCamion = computed(() => this._filter(this.tiposCamion(), this.searchTipoCamion(), (t) => t.nombre));
  rutasDisponibles = computed(() => {
    const o = this.selectedOrigenId();
    const d = this.selectedDestinoId();
    if (!o || !d) return [];
    return this.rutas().filter((r) => r.id_origen_nodo === o && r.id_destino_nodo === d);
  });
  filteredRutas = computed(() => this._filter(this.rutasDisponibles(), this.searchRuta(), (r) => r.nombre_ruta));
  rutaAutoDetectada = computed<RutaOpt | null>(() => (this.rutasDisponibles().length === 1 ? this.rutasDisponibles()[0] : null));
  efectiveRutaId = computed<number | null>(() => this.rutaAutoDetectada()?.id_ruta ?? this.selectedRutaId());
  tarifaDuplicada = computed<TarifaRow | null>(() => {
    const temporada = this.selectedTemporadaId();
    const tipo = this.selectedTipoCamionId();
    const ruta = this.efectiveRutaId();
    if (!temporada || !tipo || !ruta) return null;
    const editId = this.row ? this._num(this._pick(this.row, 'id_tarifa', 'IdTarifa')) : null;
    return this.tarifasTemporada().find((t) => t.id_temporada === temporada && t.id_tipo_camion === tipo && t.id_ruta === ruta && (!editId || t.id_tarifa !== editId)) ?? null;
  });

  form!: FormGroup;

  /** ID explícito opcional al crear (vacío → autoasignar IDENTITY). */
  idInputControl = new FormControl<number | null>(null);
  private mouseOnDropdown = false;
  private readonly dropdownMinSpacePx = 220;
  private readonly dropdownStyles: Record<DropdownKey, DropdownStyle> = {
    temporada: { top: '0px', left: '0px', width: '0px', 'max-height': '192px' },
    tipo_camion: { top: '0px', left: '0px', width: '0px', 'max-height': '192px' },
    origen: { top: '0px', left: '0px', width: '0px', 'max-height': '192px' },
    destino: { top: '0px', left: '0px', width: '0px', 'max-height': '192px' },
    ruta: { top: '0px', left: '0px', width: '0px', 'max-height': '192px' },
  };

  constructor(private fb: FormBuilder, private api: CflApiService, private router: Router) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.submitted = false;
      this._buildForm();
      this._loadCatalogos();
    }
  }

  selectTemporada(t: TemporadaOpt): void {
    this.selectedTemporadaId.set(t.id_temporada);
    this.searchTemporada.set(`${t.codigo} - ${t.nombre}`);
    this.openTemporada.set(false);
    if (!this.row) this._prefillVigenciaFromTemporada(t);
    this._loadTarifasTemporada(t.id_temporada);
  }

  selectTipoCamion(t: TipoCamionOpt): void {
    this.selectedTipoCamionId.set(t.id_tipo_camion);
    this.searchTipoCamion.set(t.nombre);
    this.openTipoCamion.set(false);
  }

  selectOrigen(n: NodoOpt): void {
    this.selectedOrigenId.set(n.id_nodo);
    this.searchOrigen.set(n.nombre);
    this.selectedRutaId.set(null);
    this.searchRuta.set('');
    this.openOrigen.set(false);
  }

  selectDestino(n: NodoOpt): void {
    this.selectedDestinoId.set(n.id_nodo);
    this.searchDestino.set(n.nombre);
    this.selectedRutaId.set(null);
    this.searchRuta.set('');
    this.openDestino.set(false);
  }

  selectRuta(r: RutaOpt): void {
    this.selectedRutaId.set(r.id_ruta);
    this.searchRuta.set(r.nombre_ruta);
    this.openRuta.set(false);
  }

  closeWithDelay(flag: ReturnType<typeof signal<boolean>>): void {
    setTimeout(() => flag.set(false), 180);
  }

  openDropdown(flag: ReturnType<typeof signal<boolean>>, key: DropdownKey, event: FocusEvent): void {
    this._setDropdownStyle(key, event);
    flag.set(true);
  }

  getDropdownStyle(key: DropdownKey): DropdownStyle {
    return this.dropdownStyles[key];
  }

  onDropdownMouseEnter(): void { this.mouseOnDropdown = true; }
  onDropdownMouseLeave(): void { this.mouseOnDropdown = false; }
  onModalScroll(): void { if (!this.mouseOnDropdown) this._closeCombos(); }

  goToRutasCreate(): void {
    this._closeCombos();
    this.cerrado.emit();
    this.router.navigate(['/mantenedores/rutas'], { queryParams: { nueva: 1 } });
  }

  onGuardar(): void {
    this.submitted = true;
    const rutaId = this.efectiveRutaId();
    if (this.form.invalid || !this.selectedTemporadaId() || !this.selectedTipoCamionId() || !rutaId) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.tarifaDuplicada() && !this.row) return;

    const payload: Record<string, unknown> = {
      id_temporada: this.selectedTemporadaId(),
      id_tipo_camion: this.selectedTipoCamionId(),
      id_ruta: rutaId,
      vigencia_desde: this.form.value.vigencia_desde || null,
      vigencia_hasta: this.form.value.vigencia_hasta || null,
      prioridad: 1,
      regla: 'BASE',
      moneda: this.form.value.moneda || 'CLP',
      monto_fijo: this.form.value.monto_fijo !== '' ? Number(this.form.value.monto_fijo) : null,
      activo: true,
    };

    // ID explícito opcional al crear (vacío → autoasignar IDENTITY)
    if (!this.row) {
      const explicitId = this.idInputControl.value;
      if (explicitId !== null && explicitId !== undefined && `${explicitId}`.trim() !== '') {
        payload['id_tarifa'] = Number(explicitId);
      }
    }

    this.saving.set(true);
    this.errorMsg.set('');

    const editId = this.row ? this._num(this._pick(this.row, 'id_tarifa', 'IdTarifa')) : null;
    const obs$ = this.row
      ? this.api.updateMaintainerRow('tarifas', Number(editId), payload)
      : this.api.createMaintainerRow('tarifas', payload);

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.guardado.emit(); },
      error: (err) => { this.errorMsg.set(err?.error?.error ?? 'Error al guardar la tarifa.'); this.saving.set(false); },
    });
  }

  private _buildForm(): void {
    this.form = this.fb.group({
      vigencia_desde: ['', Validators.required],
      vigencia_hasta: [''],
      moneda: ['CLP', Validators.required],
      monto_fijo: ['', Validators.required],
    });
    this.idInputControl.reset(null);
    this.errorMsg.set('');
    this._closeCombos();
    if (!this.row) {
      this.selectedTemporadaId.set(null);
      this.selectedOrigenId.set(null);
      this.selectedDestinoId.set(null);
      this.selectedRutaId.set(null);
      this.selectedTipoCamionId.set(null);
      this.searchTemporada.set('');
      this.searchOrigen.set('');
      this.searchDestino.set('');
      this.searchRuta.set('');
      this.searchTipoCamion.set('');
      this.tarifasTemporada.set([]);
    }
  }

  private _loadCatalogos(): void {
    this.loading.set(true);
    forkJoin({
      nodos: this.api.listMaintainerRows('nodos'),
      rutas: this.api.listMaintainerRows('rutas'),
      tipos: this.api.listMaintainerRows('tipos-camion'),
      temporadas: this.api.listMaintainerRows('temporadas'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ nodos, rutas, tipos, temporadas }) => {
        this.nodos.set(this._rows(nodos.data).map((r) => ({ id_nodo: this._num(this._pick(r, 'id_nodo', 'IdNodo')) ?? 0, nombre: String(this._pick(r, 'nombre', 'Nombre') ?? '') })).filter((n) => n.id_nodo > 0 && !!n.nombre));
        this.rutas.set(this._rows(rutas.data).map((r) => ({
          id_ruta: this._num(this._pick(r, 'id_ruta', 'IdRuta')) ?? 0,
          id_origen_nodo: this._num(this._pick(r, 'id_origen_nodo', 'IdOrigenNodo')) ?? 0,
          id_destino_nodo: this._num(this._pick(r, 'id_destino_nodo', 'IdDestinoNodo')) ?? 0,
          nombre_ruta: String(this._pick(r, 'nombre_ruta', 'NombreRuta') ?? ''),
          activo: this._bool(this._pick(r, 'activo', 'Activo')),
        })).filter((r) => r.id_ruta > 0 && r.id_origen_nodo > 0 && r.id_destino_nodo > 0 && !!r.nombre_ruta));
        this.tiposCamion.set(this._rows(tipos.data).map((r) => ({ id_tipo_camion: this._num(this._pick(r, 'id_tipo_camion', 'IdTipoCamion')) ?? 0, nombre: String(this._pick(r, 'nombre', 'Nombre') ?? '') })).filter((t) => t.id_tipo_camion > 0 && !!t.nombre));
        this.temporadas.set(this._rows(temporadas.data).map((r) => ({
          id_temporada: this._num(this._pick(r, 'id_temporada', 'IdTemporada')) ?? 0,
          codigo: String(this._pick(r, 'codigo', 'Codigo') ?? ''),
          nombre: String(this._pick(r, 'nombre', 'Nombre') ?? ''),
          fecha_inicio: this._toDateInput(this._pick(r, 'fecha_inicio', 'FechaInicio')),
          fecha_fin: this._toDateInput(this._pick(r, 'fecha_fin', 'FechaFin')),
        })).filter((t) => t.id_temporada > 0 && !!t.codigo && !!t.nombre));
        if (this.row) this._prefillEdit();
        this.loading.set(false);
      },
      error: () => { this.errorMsg.set('Error cargando catalogos.'); this.loading.set(false); },
    });
  }

  private _prefillEdit(): void {
    if (!this.row) return;
    const temporadaId = this._num(this._pick(this.row, 'id_temporada', 'IdTemporada'));
    const rutaId = this._num(this._pick(this.row, 'id_ruta', 'IdRuta'));
    const tipoId = this._num(this._pick(this.row, 'id_tipo_camion', 'IdTipoCamion'));
    this.selectedTemporadaId.set(temporadaId);
    this.selectedTipoCamionId.set(tipoId);
    const temporada = temporadaId ? this.temporadas().find((x) => x.id_temporada === temporadaId) : null;
    if (temporada) {
      this.searchTemporada.set(`${temporada.codigo} - ${temporada.nombre}`);
      this._loadTarifasTemporada(temporadaId!);
    }
    if (tipoId) {
      const tc = this.tiposCamion().find((x) => x.id_tipo_camion === tipoId);
      if (tc) this.searchTipoCamion.set(tc.nombre);
    }
    if (rutaId) {
      const ruta = this.rutas().find((x) => x.id_ruta === rutaId);
      if (ruta) {
        this.selectedRutaId.set(ruta.id_ruta);
        this.selectedOrigenId.set(ruta.id_origen_nodo);
        this.selectedDestinoId.set(ruta.id_destino_nodo);
        const o = this.nodos().find((n) => n.id_nodo === ruta.id_origen_nodo);
        const d = this.nodos().find((n) => n.id_nodo === ruta.id_destino_nodo);
        if (o) this.searchOrigen.set(o.nombre);
        if (d) this.searchDestino.set(d.nombre);
      }
    }
    // Vigencias: si la tarifa no tiene valores guardados (p.ej. se guardó sin
    // VigenciaHasta), usamos las fechas de la temporada como sugerencia para
    // que el usuario parta desde un estado útil. Coherente con `_prefillVigenciaFromTemporada`
    // del flujo de creación.
    const savedDesde = this._toDateInput(this._pick(this.row, 'vigencia_desde', 'VigenciaDesde'));
    const savedHasta = this._toDateInput(this._pick(this.row, 'vigencia_hasta', 'VigenciaHasta'));
    this.form.patchValue({
      vigencia_desde: savedDesde || temporada?.fecha_inicio || '',
      vigencia_hasta: savedHasta || temporada?.fecha_fin || '',
      moneda: this._pick(this.row, 'moneda', 'Moneda') ?? 'CLP',
      monto_fijo: this._pick(this.row, 'monto_fijo', 'MontoFijo') ?? '',
    });
  }

  private _loadTarifasTemporada(idTemporada: number): void {
    this.api.listTarifas(idTemporada).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.tarifasTemporada.set(this._rows(res.data).map((r) => ({
          id_tarifa: this._num(this._pick(r, 'id_tarifa', 'IdTarifa')) ?? 0,
          id_tipo_camion: this._num(this._pick(r, 'id_tipo_camion', 'IdTipoCamion')) ?? 0,
          id_temporada: this._num(this._pick(r, 'id_temporada', 'IdTemporada')) ?? 0,
          id_ruta: this._num(this._pick(r, 'id_ruta', 'IdRuta')) ?? 0,
        })).filter((t) => t.id_tarifa > 0 && t.id_tipo_camion > 0 && t.id_temporada > 0 && t.id_ruta > 0));
      },
      error: () => {},
    });
  }

  private _closeCombos(): void {
    this.openTemporada.set(false);
    this.openOrigen.set(false);
    this.openDestino.set(false);
    this.openRuta.set(false);
    this.openTipoCamion.set(false);
  }

  private _prefillVigenciaFromTemporada(temporada: TemporadaOpt): void {
    this.form.patchValue({
      vigencia_desde: temporada.fecha_inicio || '',
      vigencia_hasta: temporada.fecha_fin || '',
    });
  }

  private _setDropdownStyle(key: DropdownKey, event: FocusEvent): void {
    const input = event.target;
    if (!(input instanceof HTMLElement)) return;

    const viewportPadding = 12;
    const gap = 4;
    const rect = input.getBoundingClientRect();
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
    const spaceAbove = Math.max(0, rect.top - viewportPadding);
    const openUp = spaceBelow < this.dropdownMinSpacePx && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, available - gap));
    const top = openUp
      ? Math.max(viewportPadding, rect.top - maxHeight - gap)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + gap);

    this.dropdownStyles[key] = {
      top: `${Math.round(top)}px`,
      left: `${Math.round(rect.left)}px`,
      width: `${Math.round(rect.width)}px`,
      'max-height': `${Math.round(maxHeight)}px`,
    };
  }

  private _filter<T>(rows: T[], query: string, labeler: (r: T) => string): T[] {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => labeler(r).toLowerCase().includes(q));
  }

  private _rows(data: unknown): Record<string, unknown>[] {
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  }

  private _pick(row: Record<string, unknown> | null, ...keys: string[]): unknown {
    if (!row) return undefined;
    for (const key of keys) if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    return undefined;
  }

  private _num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private _bool(v: unknown): boolean | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    return ['1', 'true', 't', 'yes', 'si', 'y'].includes(String(v).trim().toLowerCase());
  }

  private _toDateInput(v: unknown): string {
    return toLocalDateInput(v);
  }
}
