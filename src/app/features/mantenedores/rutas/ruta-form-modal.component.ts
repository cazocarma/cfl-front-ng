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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { MantenedorConfig } from '../mantenedor.config';

interface NodoOpt { id_nodo: number; nombre: string; codigo?: string; }
interface RutaOpt {
  id_ruta: number;
  nombre_ruta: string;
  id_origen_nodo: number;
  id_destino_nodo: number;
  activo?: boolean;
}

@Component({
  selector: 'app-ruta-form-modal',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
             (scroll)="onModalScroll()"
             (click)="$event.stopPropagation()">
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100 bg-forest-700 text-white">
            <h2 class="font-semibold">{{ row ? 'Editar Ruta' : 'Nueva Ruta' }}</h2>
            <button type="button" (click)="cerrado.emit()">X</button>
          </div>

          <div class="px-6 py-5">
            @if (loading()) {
              <p class="text-sm text-forest-600">Cargando catalogos...</p>
            } @else {
              @if (rutaExistente()) {
                <div class="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  Ya existe una ruta para ese origen y destino: <strong>{{ rutaExistente()!.nombre_ruta }}</strong>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold mb-1.5">Nodo Origen *</label>
                  <div class="relative">
                    <input class="cfl-input" [class.border-red-400]="submitted && !selectedOrigenId()"
                           [value]="searchOrigen()" placeholder="Buscar nodo origen..."
                           (input)="searchOrigen.set($any($event.target).value)"
                           (focus)="openOrigen.set(true)" (blur)="closeWithDelay(openOrigen)" />
                    @if (openOrigen()) {
                      <div class="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto border rounded-lg bg-white shadow"
                           (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                        @for (nodo of filteredOrigen(); track nodo.id_nodo) {
                          <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                  (mousedown)="selectOrigen(nodo)">{{ nodo.nombre }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold mb-1.5">Nodo Destino *</label>
                  <div class="relative">
                    <input class="cfl-input" [class.border-red-400]="submitted && !selectedDestinoId()"
                           [value]="searchDestino()" placeholder="Buscar nodo destino..."
                           (input)="searchDestino.set($any($event.target).value)"
                           (focus)="openDestino.set(true)" (blur)="closeWithDelay(openDestino)" />
                    @if (openDestino()) {
                      <div class="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto border rounded-lg bg-white shadow"
                           (mouseenter)="onDropdownMouseEnter()" (mouseleave)="onDropdownMouseLeave()">
                        @for (nodo of filteredDestino(); track nodo.id_nodo) {
                          <button type="button" class="w-full text-left px-3 py-2 text-xs hover:bg-forest-50"
                                  (mousedown)="selectDestino(nodo)">{{ nodo.nombre }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>

              <form [formGroup]="form" (ngSubmit)="onGuardar()" class="mt-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="sm:col-span-2">
                    <label class="block text-xs font-semibold mb-1.5">Nombre de Ruta *</label>
                    <input class="cfl-input" [class.border-red-400]="isInvalid('nombre_ruta')"
                           formControlName="nombre_ruta" placeholder="Ej: Santiago -> Concepcion" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold mb-1.5">Distancia (km)</label>
                    <input type="number" min="0" class="cfl-input" formControlName="distancia_km" placeholder="0" />
                  </div>
                </div>

                @if (errorMsg()) {
                  <div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{{ errorMsg() }}</div>
                }

                <div class="mt-5 flex justify-end gap-3">
                  <button type="button" class="btn-secondary" (click)="cerrado.emit()">Cancelar</button>
                  <button type="submit" class="btn-primary" [disabled]="saving() || loading()">
                    {{ saving() ? 'Guardando...' : (row ? 'Guardar cambios' : 'Crear ruta') }}
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class RutaFormModalComponent implements OnChanges {
  private destroyRef = inject(DestroyRef);

  @Input() config!: MantenedorConfig;
  @Input() row: Record<string, unknown> | null = null;
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado = new EventEmitter<void>();

  nodos = signal<NodoOpt[]>([]);
  rutas = signal<RutaOpt[]>([]);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal('');
  submitted = false;

  selectedOrigenId = signal<number | null>(null);
  selectedDestinoId = signal<number | null>(null);
  searchOrigen = signal('');
  searchDestino = signal('');
  openOrigen = signal(false);
  openDestino = signal(false);

  filteredOrigen = computed(() => this._filter(this.nodos(), this.searchOrigen(), (n) => `${n.nombre} ${n.codigo ?? ''}`));
  filteredDestino = computed(() => this._filter(this.nodos(), this.searchDestino(), (n) => `${n.nombre} ${n.codigo ?? ''}`));

  rutaExistente = computed<RutaOpt | null>(() => {
    const origen = this.selectedOrigenId();
    const destino = this.selectedDestinoId();
    if (!origen || !destino) return null;
    const editId = this.row ? this._num(this._pick(this.row, 'id_ruta', 'IdRuta')) : null;
    return this.rutas().find((r) => r.id_origen_nodo === origen && r.id_destino_nodo === destino && (!editId || r.id_ruta !== editId)) ?? null;
  });

  form!: FormGroup;
  private lastSuggestion = '';
  private mouseOnDropdown = false;

  constructor(private fb: FormBuilder, private api: CflApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.submitted = false;
      this._buildForm();
      this._loadCatalogos();
    }
  }

  selectOrigen(nodo: NodoOpt): void {
    this.selectedOrigenId.set(nodo.id_nodo);
    this.searchOrigen.set(nodo.nombre);
    this.openOrigen.set(false);
    this._suggestName();
  }

  selectDestino(nodo: NodoOpt): void {
    this.selectedDestinoId.set(nodo.id_nodo);
    this.searchDestino.set(nodo.nombre);
    this.openDestino.set(false);
    this._suggestName();
  }

  closeWithDelay(flag: ReturnType<typeof signal<boolean>>): void {
    setTimeout(() => flag.set(false), 180);
  }

  onDropdownMouseEnter(): void { this.mouseOnDropdown = true; }
  onDropdownMouseLeave(): void { this.mouseOnDropdown = false; }
  onModalScroll(): void { if (!this.mouseOnDropdown) this._closeCombos(); }

  isInvalid(key: string): boolean {
    const ctrl = this.form.get(key);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched || this.submitted));
  }

  onGuardar(): void {
    this.submitted = true;
    if (this.form.invalid || !this.selectedOrigenId() || !this.selectedDestinoId()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');

    const payload: Record<string, unknown> = {
      id_origen_nodo: this.selectedOrigenId(),
      id_destino_nodo: this.selectedDestinoId(),
      nombre_ruta: this.form.value.nombre_ruta || null,
      distancia_km: this.form.value.distancia_km !== '' ? this.form.value.distancia_km : null,
      activo: true,
    };

    const editId = this.row ? this._num(this._pick(this.row, 'id_ruta', 'IdRuta')) : null;
    const obs$ = this.row
      ? this.api.updateMaintainerRow('rutas', Number(editId), payload)
      : this.api.createMaintainerRow('rutas', payload);

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.guardado.emit(); },
      error: (err) => { this.errorMsg.set(err?.error?.error ?? 'Error al guardar la ruta.'); this.saving.set(false); },
    });
  }

  private _buildForm(): void {
    this.form = this.fb.group({
      nombre_ruta: ['', Validators.required],
      distancia_km: [''],
    });
    this.errorMsg.set('');
    this._closeCombos();
    if (!this.row) {
      this.selectedOrigenId.set(null);
      this.selectedDestinoId.set(null);
      this.searchOrigen.set('');
      this.searchDestino.set('');
      this.lastSuggestion = '';
    }
  }

  private _loadCatalogos(): void {
    this.loading.set(true);
    forkJoin({
      nodos: this.api.listMaintainerRows('nodos'),
      rutas: this.api.listMaintainerRows('rutas'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ nodos, rutas }) => {
        this.nodos.set(this._rows(nodos.data).map((r) => ({
          id_nodo: this._num(this._pick(r, 'id_nodo', 'IdNodo')) ?? 0,
          nombre: String(this._pick(r, 'nombre', 'Nombre') ?? ''),
          codigo: String(this._pick(r, 'codigo', 'Codigo', 'sap_codigo', 'SapCodigo') ?? ''),
        })).filter((n) => n.id_nodo > 0 && !!n.nombre));

        this.rutas.set(this._rows(rutas.data).map((r) => ({
          id_ruta: this._num(this._pick(r, 'id_ruta', 'IdRuta')) ?? 0,
          id_origen_nodo: this._num(this._pick(r, 'id_origen_nodo', 'IdOrigenNodo')) ?? 0,
          id_destino_nodo: this._num(this._pick(r, 'id_destino_nodo', 'IdDestinoNodo')) ?? 0,
          nombre_ruta: String(this._pick(r, 'nombre_ruta', 'NombreRuta') ?? ''),
          activo: this._bool(this._pick(r, 'activo', 'Activo')),
        })).filter((r) => r.id_ruta > 0 && r.id_origen_nodo > 0 && r.id_destino_nodo > 0 && !!r.nombre_ruta));

        if (this.row) this._prefillEdit();
        this.loading.set(false);
      },
      error: () => { this.errorMsg.set('Error cargando catalogos.'); this.loading.set(false); },
    });
  }

  private _prefillEdit(): void {
    if (!this.row) return;
    const origen = this._num(this._pick(this.row, 'id_origen_nodo', 'IdOrigenNodo'));
    const destino = this._num(this._pick(this.row, 'id_destino_nodo', 'IdDestinoNodo'));
    this.selectedOrigenId.set(origen);
    this.selectedDestinoId.set(destino);
    const o = origen ? this.nodos().find((n) => n.id_nodo === origen) : null;
    const d = destino ? this.nodos().find((n) => n.id_nodo === destino) : null;
    if (o) this.searchOrigen.set(o.nombre);
    if (d) this.searchDestino.set(d.nombre);
    this.form.patchValue({
      nombre_ruta: this._pick(this.row, 'nombre_ruta', 'NombreRuta') ?? '',
      distancia_km: this._pick(this.row, 'distancia_km', 'DistanciaKm') ?? '',
    });
  }

  private _suggestName(): void {
    const origen = this.selectedOrigenId();
    const destino = this.selectedDestinoId();
    if (!origen || !destino) return;
    const o = this.nodos().find((n) => n.id_nodo === origen);
    const d = this.nodos().find((n) => n.id_nodo === destino);
    if (!o || !d) return;
    const suggested = `${o.nombre} -> ${d.nombre}`;
    const current = String(this.form.get('nombre_ruta')?.value ?? '').trim();
    if (!current || current === this.lastSuggestion) {
      this.form.get('nombre_ruta')?.setValue(suggested);
      this.lastSuggestion = suggested;
    }
  }

  private _closeCombos(): void {
    this.openOrigen.set(false);
    this.openDestino.set(false);
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
}
