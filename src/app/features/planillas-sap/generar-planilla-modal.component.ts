import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CflApiService } from '../../core/services/cfl-api.service';
import {
  GenerarPlanillaRequest,
  MovimientoPlanillaRow,
  ProductorOcRow,
} from '../../core/models/planilla-sap.model';
import { formatCLP } from '../../core/utils/format.utils';

@Component({
    selector: 'app-generar-planilla-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, FormsModule],
    template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="cancel.emit()"
      >
        <div
          class="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div
            class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
            style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);"
          >
            <div>
              <h2 class="text-lg font-bold text-white">Generar Planilla SAP</h2>
              <p class="text-xs text-green-200 mt-0.5">
                {{ facturasIds.length }} pre factura{{ facturasIds.length !== 1 ? 's' : '' }}
              </p>
            </div>
            <button type="button" (click)="cancel.emit()" class="text-white/70 hover:text-white transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 space-y-6">

            <!-- Resumen -->
            <div class="grid grid-cols-3 gap-4">
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Pre Facturas</p>
                <p class="mt-1 text-sm font-bold text-forest-900">{{ facturasIds.length }}</p>
              </div>
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Movimientos</p>
                <p class="mt-1 text-sm font-bold text-forest-900">
                  {{ selectedCount() }} / {{ movimientos().length }}
                </p>
              </div>
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Monto Total</p>
                <p class="mt-1 text-sm font-bold text-teal-700">{{ fmtCLP(selectedTotal()) }}</p>
              </div>
            </div>

            <!-- Formulario -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Fecha Documento <span class="text-red-500">*</span>
                </label>
                <input type="date" [(ngModel)]="formData.fecha_documento"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" required />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Fecha Contabilización <span class="text-red-500">*</span>
                </label>
                <input type="date" [(ngModel)]="formData.fecha_contabilizacion"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" required />
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Glosa Cabecera <span class="text-red-500">*</span>
                </label>
                <input type="text" [(ngModel)]="formData.glosa_cabecera" placeholder="Ej: FLETES VARIOS ZONA SUR"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" required />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Temporada</label>
                <input type="text" [(ngModel)]="formData.temporada" placeholder="Ej: 2025"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Indicador Impuesto</label>
                <input type="text" [(ngModel)]="formData.indicador_impuesto" placeholder="Ej: C0"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Código Cargo/Abono</label>
                <input type="text" [(ngModel)]="formData.codigo_cargo_abono" placeholder="Ej: 2012"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" />
              </div>
            </div>

            <!-- Tabla Movimientos -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-forest-800 uppercase tracking-wide">
                  Movimientos
                  <span class="ml-2 inline-flex items-center rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
                    {{ selectedCount() }} / {{ movimientos().length }}
                  </span>
                </h3>
                <button type="button" (click)="toggleAll()" class="text-xs font-semibold text-forest-600 hover:text-forest-900">
                  {{ allSelected() ? 'Deseleccionar todos' : 'Seleccionar todos' }}
                </button>
              </div>

              @if (loadingMovimientos()) {
                <div class="flex items-center justify-center py-8">
                  <svg class="animate-spin w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              } @else if (movimientos().length === 0) {
                <p class="text-sm text-forest-400 text-center py-4">No se encontraron movimientos.</p>
              } @else {
                <div class="rounded-xl border border-forest-100 overflow-hidden max-h-64 overflow-y-auto">
                  <table class="min-w-full text-xs">
                    <thead class="sticky top-0 bg-forest-50 border-b border-forest-100">
                      <tr>
                        <th class="px-2 py-2 w-8">
                          <input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" class="rounded" />
                        </th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Factura</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Fecha</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Guía</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">CC</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Cta Mayor</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Productor</th>
                        <th class="px-2 py-2 text-left font-semibold uppercase tracking-wider text-forest-600">Especie</th>
                        <th class="px-2 py-2 text-right font-semibold uppercase tracking-wider text-forest-600">Monto</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-50">
                      @for (mov of movimientos(); track mov.id_cabecera_flete) {
                        <tr class="hover:bg-forest-50/50 transition-colors"
                            [class.opacity-40]="!mov.selected">
                          <td class="px-2 py-1.5">
                            <input type="checkbox" [(ngModel)]="mov.selected" (ngModelChange)="onSelectionChange()" class="rounded" />
                          </td>
                          <td class="px-2 py-1.5 text-forest-700">{{ mov.numero_factura }}</td>
                          <td class="px-2 py-1.5 text-forest-600">{{ mov.fecha_salida | date:'dd/MM' }}</td>
                          <td class="px-2 py-1.5 text-forest-700 font-mono">{{ mov.numero_guia || '-' }}</td>
                          <td class="px-2 py-1.5 text-forest-700">{{ mov.centro_costo_codigo }}</td>
                          <td class="px-2 py-1.5 text-forest-700">{{ mov.cuenta_mayor_codigo }}</td>
                          <td class="px-2 py-1.5 text-forest-900 truncate max-w-[140px]">{{ mov.productor_nombre }}</td>
                          <td class="px-2 py-1.5 text-forest-600">{{ mov.especie_nombre || '-' }}</td>
                          <td class="px-2 py-1.5 text-right font-semibold text-forest-900">{{ fmtCLP(mov.monto_aplicado) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <!-- Tabla Productores (computed) -->
            @if (productores().length > 0) {
              <div>
                <h3 class="text-sm font-bold text-forest-800 uppercase tracking-wide mb-3">
                  Productores
                  <span class="ml-2 inline-flex items-center rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
                    {{ productores().length }}
                  </span>
                </h3>

                <div class="rounded-xl border border-forest-100 overflow-hidden">
                  <table class="min-w-full">
                    <thead>
                      <tr class="bg-forest-50 border-b border-forest-100">
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Código</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Nombre</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Monto</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Especie(s)</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Orden de Compra</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Pos OC</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-50">
                      @for (prod of productores(); track prod.id_productor) {
                        <tr class="hover:bg-forest-50/50 transition-colors"
                            [class.bg-red-50]="!prod.codigo_proveedor"
                            [class.border-l-2]="!prod.codigo_proveedor"
                            [class.border-red-400]="!prod.codigo_proveedor">
                          <td class="px-3 py-2 text-sm font-mono"
                              [class.text-red-600]="!prod.codigo_proveedor"
                              [class.text-forest-700]="prod.codigo_proveedor">
                            {{ prod.codigo_proveedor || 'SIN CÓDIGO' }}
                          </td>
                          <td class="px-3 py-2 text-sm text-forest-900">{{ prod.nombre }}</td>
                          <td class="px-3 py-2 text-sm text-forest-900 text-right font-semibold">{{ fmtCLP(prod.monto) }}</td>
                          <td class="px-3 py-2 text-sm text-forest-700">{{ prod.especies.join(', ') || '-' }}</td>
                          <td class="px-3 py-2">
                            <input type="text" [(ngModel)]="prod.orden_compra" placeholder="OC"
                              class="w-full rounded-md border border-forest-200 bg-white px-2 py-1 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" />
                          </td>
                          <td class="px-3 py-2">
                            <input type="text" [(ngModel)]="prod.posicion_oc" placeholder="10"
                              class="w-20 rounded-md border border-forest-200 bg-white px-2 py-1 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (hasProductorSinCodigo()) {
                  <p class="mt-2 text-xs text-red-600">
                    Hay productores sin código SAP. Asigne un CodigoProveedor antes de generar.
                  </p>
                }
              </div>
            }

            <!-- Error -->
            @if (errorMsg()) {
              <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p class="text-sm text-red-700">{{ errorMsg() }}</p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="sticky bottom-0 flex items-center justify-end gap-3 border-t border-forest-100 bg-white px-6 py-4">
            <button type="button" (click)="cancel.emit()" [disabled]="submitting()"
              class="rounded-lg border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50 transition">
              Cancelar
            </button>
            <button type="button" (click)="onGenerar()" [disabled]="submitting() || !isFormValid()"
              class="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50 transition">
              @if (submitting()) {
                <span class="inline-flex items-center gap-2">
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Generando...
                </span>
              } @else {
                Generar Planilla
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class GenerarPlanillaModalComponent implements OnChanges {
  private api = inject(CflApiService);
  private destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() facturasIds: number[] = [];

  @Output() cancel = new EventEmitter<void>();
  @Output() generated = new EventEmitter<void>();

  movimientos = signal<MovimientoPlanillaRow[]>([]);
  loadingMovimientos = signal(false);
  submitting = signal(false);
  errorMsg = signal('');

  // Computed from selection
  private selectionVersion = signal(0);

  selectedCount = computed(() => {
    this.selectionVersion(); // trigger reactivity
    return this.movimientos().filter(m => m.selected).length;
  });

  selectedTotal = computed(() => {
    this.selectionVersion();
    return this.movimientos().filter(m => m.selected).reduce((s, m) => s + (m.monto_aplicado || 0), 0);
  });

  allSelected = computed(() => {
    this.selectionVersion();
    const movs = this.movimientos();
    return movs.length > 0 && movs.every(m => m.selected);
  });

  productores = computed((): ProductorOcRow[] => {
    this.selectionVersion();
    const selected = this.movimientos().filter(m => m.selected);
    const grouped = new Map<number, ProductorOcRow>();

    for (const m of selected) {
      if (!m.id_productor) continue;
      const existing = grouped.get(m.id_productor);
      if (existing) {
        existing.monto += m.monto_aplicado || 0;
        if (m.especie_nombre && !existing.especies.includes(m.especie_nombre)) {
          existing.especies.push(m.especie_nombre);
        }
      } else {
        grouped.set(m.id_productor, {
          id_productor: m.id_productor,
          codigo_proveedor: m.codigo_proveedor || '',
          nombre: m.productor_nombre || '',
          monto: m.monto_aplicado || 0,
          especies: m.especie_nombre ? [m.especie_nombre] : [],
          orden_compra: '',
          posicion_oc: '10',
        });
      }
    }

    return Array.from(grouped.values());
  });

  hasProductorSinCodigo = computed(() => this.productores().some(p => !p.codigo_proveedor));

  formData = {
    fecha_documento: '',
    fecha_contabilizacion: '',
    glosa_cabecera: '',
    temporada: '',
    indicador_impuesto: '',
    codigo_cargo_abono: '',
    glosa_cargo_abono: '',
  };

  fmtCLP = formatCLP;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
      this.loadMovimientos();
    }
  }

  isFormValid(): boolean {
    return !!(
      this.formData.fecha_documento &&
      this.formData.fecha_contabilizacion &&
      this.formData.glosa_cabecera.trim() &&
      this.selectedCount() > 0 &&
      !this.hasProductorSinCodigo()
    );
  }

  onSelectionChange(): void {
    this.selectionVersion.update(v => v + 1);
  }

  toggleAll(): void {
    const newState = !this.allSelected();
    for (const m of this.movimientos()) {
      m.selected = newState;
    }
    this.onSelectionChange();
  }

  onGenerar(): void {
    if (!this.isFormValid() || this.submitting()) return;

    this.submitting.set(true);
    this.errorMsg.set('');

    const selectedMovs = this.movimientos().filter(m => m.selected);

    const body: GenerarPlanillaRequest = {
      facturas_ids: [...new Set(selectedMovs.map(m => m.id_factura))],
      movimientos_ids: selectedMovs.map(m => m.id_cabecera_flete),
      fecha_documento: this.formData.fecha_documento,
      fecha_contabilizacion: this.formData.fecha_contabilizacion,
      glosa_cabecera: this.formData.glosa_cabecera.trim(),
      temporada: this.formData.temporada.trim() || null,
      codigo_cargo_abono: this.formData.codigo_cargo_abono.trim() || null,
      glosa_cargo_abono: this.formData.glosa_cargo_abono.trim() || null,
      indicador_impuesto: this.formData.indicador_impuesto.trim() || undefined,
      productores_oc: this.productores()
        .filter(p => p.orden_compra)
        .map(p => ({
          id_productor: p.id_productor,
          orden_compra: p.orden_compra,
          posicion_oc: p.posicion_oc || undefined,
        })),
    };

    this.api.generarPlanillaSap(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.generated.emit();
        },
        error: (err) => {
          this.submitting.set(false);
          const msg = err?.error?.message || err?.error?.error || 'Error al generar la planilla SAP.';
          this.errorMsg.set(msg);
        },
      });
  }

  private resetForm(): void {
    this.formData = {
      fecha_documento: '',
      fecha_contabilizacion: '',
      glosa_cabecera: '',
      temporada: '',
      indicador_impuesto: '',
      codigo_cargo_abono: '',
      glosa_cargo_abono: '',
    };
    this.movimientos.set([]);
    this.errorMsg.set('');
    this.submitting.set(false);
    this.selectionVersion.set(0);
  }

  private loadMovimientos(): void {
    if (!this.facturasIds.length) return;

    this.loadingMovimientos.set(true);

    this.api.getPlanillaMovimientos(this.facturasIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows: MovimientoPlanillaRow[] = (res.data || []).map(r => ({
            ...r,
            selected: true,
          }));
          this.movimientos.set(rows);
          this.loadingMovimientos.set(false);
          this.onSelectionChange();
        },
        error: () => {
          this.loadingMovimientos.set(false);
          this.errorMsg.set('No se pudieron cargar los movimientos.');
        },
      });
  }
}
