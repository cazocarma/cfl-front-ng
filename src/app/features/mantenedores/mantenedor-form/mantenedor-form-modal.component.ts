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
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { toLocalDateInput } from '../../../core/utils/format.utils';
import { CampoDef, MantenedorConfig } from '../mantenedor.config';
import { UsuarioFormModalComponent } from '../usuarios/usuario-form-modal.component';
import { RutaFormModalComponent } from '../rutas/ruta-form-modal.component';
import { TarifaFormModalComponent } from '../tarifas/tarifa-form-modal.component';

// Tipo de opciones cargadas para select-entity
type EntityOptions = Record<string, Record<string, unknown>[]>;

@Component({
    selector: 'app-mantenedor-form-modal',
    imports: [ReactiveFormsModule, UsuarioFormModalComponent, RutaFormModalComponent, TarifaFormModalComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <!-- Delegación a modal especial para usuarios -->
    @if (config.tipoEspecial === 'usuarios') {
      <app-usuario-form-modal
        [row]="row"
        [visible]="visible"
        (guardado)="guardado.emit()"
        (cerrado)="cerrado.emit()"
      />
    }

    <!-- Delegación a modal especial para rutas -->
    @if (config.tipoEspecial === 'rutas') {
      <app-ruta-form-modal
        [config]="config"
        [row]="row"
        [visible]="visible"
        (guardado)="guardado.emit()"
        (cerrado)="cerrado.emit()"
      />
    }

    <!-- Delegación a modal especial para tarifas -->
    @if (config.tipoEspecial === 'tarifas') {
      <app-tarifa-form-modal
        [config]="config"
        [row]="row"
        [visible]="visible"
        (guardado)="guardado.emit()"
        (cerrado)="cerrado.emit()"
      />
    }

    <!-- Modal genérico para todas las demás entidades -->
    @if (config.tipoEspecial !== 'usuarios' && config.tipoEspecial !== 'rutas' && config.tipoEspecial !== 'tarifas' && visible) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <div
          class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          (scroll)="onModalScroll()"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <div>
              <h2 class="text-lg font-bold text-white">
                {{ row ? 'Editar' : 'Agregar' }} {{ config.title }}
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

          <!-- Body -->
          <form [formGroup]="form" (ngSubmit)="onGuardar()" class="px-6 py-6">

            @if (loadingCatalogos()) {
              <div class="flex justify-center py-12">
                <svg class="animate-spin w-8 h-8 text-forest-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            } @else {

              <!-- Campos del formulario en grid de 2 columnas -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                @for (campo of camposActivos(); track campo.key) {
                  <div [class]="campo.tipo === 'textarea' || campo.tipo === 'boolean' ? 'sm:col-span-2' : ''">

                    <label class="block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5">
                      {{ campo.label }}{{ campo.required ? ' *' : '' }}
                    </label>

                    <!-- boolean -->
                    @if (campo.tipo === 'boolean') {
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" [formControlName]="campo.key"
                               class="h-4 w-4 rounded border-forest-300 text-forest-600 focus:ring-forest-500" />
                        <span class="text-sm text-forest-700">{{ campo.label }}</span>
                      </label>
                    }

                    <!-- textarea -->
                    @else if (campo.tipo === 'textarea') {
                      <textarea
                        [formControlName]="campo.key"
                        class="cfl-input min-h-[80px] resize-y"
                        [placeholder]="campo.placeholder ?? ''"
                      ></textarea>
                    }

                    <!-- select-static -->
                    @else if (campo.tipo === 'select-static') {
                      <select [formControlName]="campo.key" class="cfl-select"
                              [class.border-red-400]="isInvalid(campo.key)">
                        <option value="">{{ campo.nullLabel ?? 'Seleccionar...' }}</option>
                        @for (opt of campo.opciones; track opt.value) {
                          <option [value]="opt.value">{{ opt.label }}</option>
                        }
                      </select>
                    }

                    <!-- select-entity (combobox con búsqueda) -->
                    @else if (campo.tipo === 'select-entity') {
                      <div class="relative">
                        <!-- Input de búsqueda -->
                        <input
                          type="text"
                          class="cfl-input pr-8"
                          [class.border-red-400]="isInvalid(campo.key)"
                          [placeholder]="campo.nullLabel ?? 'Buscar...'"
                          [value]="getSearchLabel(campo)"
                          (input)="onEntitySearch(campo, $any($event.target).value)"
                          (focus)="openDropdown(campo.key)"
                          (blur)="closeDropdownDelayed(campo.key)"
                          autocomplete="off"
                        />
                        <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-forest-400">
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                          </svg>
                        </span>
                        <!-- Dropdown -->
                        @if (dropdownOpen[campo.key]) {
                          <div
                            class="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-forest-200 bg-white shadow-lg"
                            (mouseenter)="onDropdownMouseEnter()"
                            (mouseleave)="onDropdownMouseLeave()"
                          >
                            <!-- Opción vacía -->
                            <button type="button" (mousedown)="selectEntity(campo, null)"
                                    class="w-full px-3 py-2 text-left text-xs text-forest-400 hover:bg-forest-50 border-b border-forest-100">
                              {{ campo.nullLabel ?? '— Sin selección' }}
                            </button>
                            @for (opt of getFilteredEntityOptions(campo); track $index) {
                              <button
                                type="button"
                                (mousedown)="selectEntity(campo, opt)"
                                class="w-full px-3 py-2 text-left text-xs text-forest-800 hover:bg-forest-50 transition-colors"
                              >
                                {{ getOptionLabel(opt, campo.labelFields ?? []) }}
                              </button>
                            }
                            @if (getFilteredEntityOptions(campo).length === 0) {
                              <p class="px-3 py-2 text-xs text-forest-400">Sin resultados</p>
                            }
                          </div>
                        }
                      </div>
                    }

                    <!-- number -->
                    @else if (campo.tipo === 'number') {
                      <input
                        type="number"
                        [formControlName]="campo.key"
                        class="cfl-input"
                        [class.border-red-400]="isInvalid(campo.key)"
                        [placeholder]="campo.placeholder ?? '0'"
                        [min]="campo.min ?? 0"
                        [attr.max]="campo.max ?? null"
                      />
                    }

                    <!-- date -->
                    @else if (campo.tipo === 'date') {
                      <input
                        type="date"
                        [formControlName]="campo.key"
                        class="cfl-input"
                        [class.border-red-400]="isInvalid(campo.key)"
                      />
                    }

                    <!-- email -->
                    @else if (campo.tipo === 'email') {
                      <input
                        type="email"
                        [formControlName]="campo.key"
                        class="cfl-input"
                        [class.border-red-400]="isInvalid(campo.key)"
                        [placeholder]="campo.placeholder ?? ''"
                      />
                    }

                    <!-- text (default) -->
                    @else {
                      <input
                        type="text"
                        [formControlName]="campo.key"
                        class="cfl-input"
                        [class.border-red-400]="isInvalid(campo.key)"
                        [placeholder]="campo.placeholder ?? ''"
                      />
                    }

                    <!-- Error inline -->
                    @if (isInvalid(campo.key)) {
                      <p class="mt-1 text-xs text-red-600">Campo requerido</p>
                    }

                  </div>
                }
              </div><!-- /grid -->

              <!-- Error general -->
              @if (errorMsg()) {
                <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ errorMsg() }}
                </div>
              }

              <!-- Footer -->
              <div class="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-forest-100">
                <button type="button" (click)="cerrado.emit()" class="btn-secondary">Cancelar</button>
                <button
                  type="submit"
                  [disabled]="form.invalid || saving() || loadingCatalogos()"
                  class="btn-primary disabled:cursor-not-allowed"
                >
                  @if (saving()) {
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Guardando...
                  } @else {
                    {{ row ? 'Guardar cambios' : 'Crear registro' }}
                  }
                </button>
              </div>

            }<!-- /else loadingCatalogos -->

          </form>
        </div>
      </div>
    }
  `
})
export class MantenedorFormModalComponent implements OnChanges {
  private destroyRef = inject(DestroyRef);

  @Input() config!: MantenedorConfig;
  @Input() row: Record<string, unknown> | null = null; // null = crear, datos = editar
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado  = new EventEmitter<void>();

  form!: FormGroup;
  loadingCatalogos = signal(false);
  saving           = signal(false);
  errorMsg         = signal('');

  // Datos cargados de entidades FK
  entityOptions = signal<EntityOptions>({});

  // Estado de búsqueda por campo
  searchTexts: Record<string, string> = {};
  dropdownOpen: Record<string, boolean> = {};
  private mouseOnDropdown = false;

  // Campos activos (crear vs editar)
  camposActivos = signal<CampoDef[]>([]);

  constructor(private fb: FormBuilder, private api: CflApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this._initForm();
      this._loadEntityOptions();
    }
    if (changes['config']) {
      this._initForm();
    }
  }

  // ── Inicialización del formulario ──────────────────────────
  private _initForm(): void {
    if (!this.config) return;

    const campos = this.row
      ? (this.config.camposEditar ?? this.config.camposCrear)
      : this.config.camposCrear;

    this.camposActivos.set(campos);
    this.searchTexts = {};
    this.dropdownOpen = {};

    const controls: Record<string, unknown[]> = {};
    for (const campo of campos) {
      const validators = campo.required ? [Validators.required] : [];
      if (campo.tipo === 'email') validators.push(Validators.email);

      let value: unknown = '';
      if (this.row && campo.tipo !== 'password') {
        value = this.row[campo.key] ?? '';
        if (campo.tipo === 'boolean') value = Boolean(this.row[campo.key]);
        if (campo.tipo === 'date' && this.row[campo.key]) {
          value = toLocalDateInput(this.row[campo.key]);
        }
        // Para select-entity, inicializar también el searchText
        if (campo.tipo === 'select-entity') {
          this.searchTexts[campo.key] = '';
        }
      }
      controls[campo.key] = [value, validators];
    }

    this.form = this.fb.group(controls);
    this.errorMsg.set('');
  }

  // ── Cargar opciones de entidades FK ───────────────────────
  private _loadEntityOptions(): void {
    if (!this.config) return;

    const campos = this.row
      ? (this.config.camposEditar ?? this.config.camposCrear)
      : this.config.camposCrear;

    const entityFields = campos.filter(c => c.tipo === 'select-entity' && c.entity);
    const uniqueEntities = [...new Set(entityFields.map(c => c.entity!))];

    if (uniqueEntities.length === 0) return;

    this.loadingCatalogos.set(true);

    const requests: Record<string, ReturnType<CflApiService['listMaintainerRows']>> = {};
    for (const entity of uniqueEntities) {
      requests[entity] = this.api.listMaintainerRows(entity);
    }

    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (results) => {
        const opts: EntityOptions = {};
        for (const [entity, res] of Object.entries(results)) {
          opts[entity] = (res.data as Record<string, unknown>[]) ?? [];
        }
        this.entityOptions.set(opts);

        // Pre-populate searchText labels si hay row cargado
        if (this.row) {
          for (const campo of entityFields) {
            if (campo.entity) {
              const idVal = this.row[campo.key];
              if (idVal !== undefined && idVal !== null) {
                const opciones = opts[campo.entity] ?? [];
                const found = opciones.find(o => String(o[campo.valueField ?? 'id']) === String(idVal));
                if (found) {
                  this.searchTexts[campo.key] = this.getOptionLabel(found, campo.labelFields ?? []);
                }
              }
            }
          }
        }

        this.loadingCatalogos.set(false);
      },
      error: () => {
        this.errorMsg.set('Error cargando catálogos de selección.');
        this.loadingCatalogos.set(false);
      },
    });
  }

  // ── Combobox helpers ───────────────────────────────────────
  getOptionLabel(opt: Record<string, unknown>, labelFields: string[]): string {
    return labelFields.map(f => String(opt[f] ?? '')).filter(Boolean).join(' — ');
  }

  getSearchLabel(campo: CampoDef): string {
    return this.searchTexts[campo.key] ?? '';
  }

  getFilteredEntityOptions(campo: CampoDef): Record<string, unknown>[] {
    const all = this.entityOptions()[campo.entity ?? ''] ?? [];
    const q = (this.searchTexts[campo.key] ?? '').toLowerCase();
    if (!q) return all;
    return all.filter(opt => {
      const label = this.getOptionLabel(opt, campo.labelFields ?? []).toLowerCase();
      return label.includes(q);
    });
  }

  onEntitySearch(campo: CampoDef, value: string): void {
    this.searchTexts[campo.key] = value;
    // Si el texto se borra, limpia el control
    if (!value) {
      this.form.get(campo.key)?.setValue('');
    }
    this.openDropdown(campo.key);
  }

  selectEntity(campo: CampoDef, opt: Record<string, unknown> | null): void {
    if (!opt) {
      this.form.get(campo.key)?.setValue('');
      this.searchTexts[campo.key] = '';
    } else {
      const val = opt[campo.valueField ?? 'id'];
      this.form.get(campo.key)?.setValue(val);
      this.searchTexts[campo.key] = this.getOptionLabel(opt, campo.labelFields ?? []);
    }
    this.dropdownOpen[campo.key] = false;
  }

  openDropdown(key: string): void { this.dropdownOpen[key] = true; }
  closeDropdownDelayed(key: string): void {
    setTimeout(() => { this.dropdownOpen[key] = false; }, 200);
  }
  onDropdownMouseEnter(): void { this.mouseOnDropdown = true; }
  onDropdownMouseLeave(): void { this.mouseOnDropdown = false; }
  onModalScroll(): void {
    if (this.mouseOnDropdown) return;
    for (const key of Object.keys(this.dropdownOpen)) this.dropdownOpen[key] = false;
  }

  // ── Validación ─────────────────────────────────────────────
  isInvalid(key: string): boolean {
    const ctrl = this.form.get(key);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  // ── Submit ─────────────────────────────────────────────────
  onGuardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (!this.config) return;

    this.saving.set(true);
    this.errorMsg.set('');

    const payload = this._buildPayload();

    const obs$ = this.row
      ? this.api.updateMaintainerRow(this.config.key, Number(this.row[this.config.idField]), payload)
      : this.api.createMaintainerRow(this.config.key, payload);

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.guardado.emit(); },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al guardar el registro.');
        this.saving.set(false);
      },
    });
  }

  private _buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...this.form.value };
    for (const key of Object.keys(payload)) {
      if (payload[key] === '' || payload[key] === undefined) payload[key] = null;
    }
    return payload;
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.cerrado.emit();
  }
}
