import {
  Component,
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
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { CflApiService } from '../../core/services/cfl-api.service';
import { GenerarPlanillaRequest, ProductorOcRow } from '../../core/models/planilla-sap.model';
import { formatCLP } from '../../core/utils/format.utils';

@Component({
    selector: 'app-generar-planilla-modal',
    imports: [FormsModule],
    template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="cancel.emit()"
      >
        <div
          class="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
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
                Pre Factura {{ facturaNumero }} &middot; {{ empresaNombre }}
              </p>
            </div>
            <button
              type="button"
              (click)="cancel.emit()"
              class="text-white/70 hover:text-white transition"
            >
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
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Pre Factura</p>
                <p class="mt-1 text-sm font-bold text-forest-900">{{ facturaNumero }}</p>
              </div>
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Empresa</p>
                <p class="mt-1 text-sm font-bold text-forest-900">{{ empresaNombre }}</p>
              </div>
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-forest-500">Monto Total</p>
                <p class="mt-1 text-sm font-bold text-forest-900">{{ fmtCLP(montoTotal) }}</p>
              </div>
            </div>

            <!-- Formulario -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Fecha Documento <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  [(ngModel)]="formData.fecha_documento"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                  required
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Fecha Contabilizacion <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  [(ngModel)]="formData.fecha_contabilizacion"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                  required
                />
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-semibold text-forest-700 mb-1">
                  Glosa Cabecera <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="formData.glosa_cabecera"
                  placeholder="Ej: FLETES VARIOS ZONA SUR"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                  required
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Temporada</label>
                <input
                  type="text"
                  [(ngModel)]="formData.temporada"
                  placeholder="Opcional"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Indicador Impuesto</label>
                <input
                  type="text"
                  [(ngModel)]="formData.indicador_impuesto"
                  placeholder="Ej: I1"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Codigo Cargo/Abono</label>
                <input
                  type="text"
                  [(ngModel)]="formData.codigo_cargo_abono"
                  placeholder="Opcional"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-forest-700 mb-1">Glosa Cargo/Abono</label>
                <input
                  type="text"
                  [(ngModel)]="formData.glosa_cargo_abono"
                  placeholder="Opcional"
                  class="w-full rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                />
              </div>
            </div>

            <!-- Tabla Productores -->
            <div>
              <h3 class="text-sm font-bold text-forest-800 uppercase tracking-wide mb-3">
                Productores
                <span class="ml-2 inline-flex items-center rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
                  {{ productores().length }}
                </span>
              </h3>

              @if (loadingProductores()) {
                <div class="flex items-center justify-center py-8">
                  <svg class="animate-spin w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              } @else if (productores().length === 0) {
                <p class="text-sm text-forest-400 text-center py-4">No se encontraron productores en esta pre factura.</p>
              } @else {
                <div class="rounded-xl border border-forest-100 overflow-hidden">
                  <table class="min-w-full">
                    <thead>
                      <tr class="bg-forest-50 border-b border-forest-100">
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Codigo</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Nombre</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Monto</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Especie</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Orden de Compra</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Posicion OC</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-50">
                      @for (prod of productores(); track prod.id_productor) {
                        <tr class="hover:bg-forest-50/50 transition-colors">
                          <td class="px-3 py-2 text-sm text-forest-700 font-mono">{{ prod.codigo_proveedor }}</td>
                          <td class="px-3 py-2 text-sm text-forest-900">{{ prod.nombre }}</td>
                          <td class="px-3 py-2 text-sm text-forest-900 text-right font-semibold">{{ fmtCLP(prod.monto) }}</td>
                          <td class="px-3 py-2 text-sm text-forest-700">{{ prod.especie ?? '-' }}</td>
                          <td class="px-3 py-2">
                            <input
                              type="text"
                              [(ngModel)]="prod.orden_compra"
                              placeholder="OC"
                              class="w-full rounded-md border border-forest-200 bg-white px-2 py-1 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                            />
                          </td>
                          <td class="px-3 py-2">
                            <input
                              type="text"
                              [(ngModel)]="prod.posicion_oc"
                              placeholder="10"
                              class="w-20 rounded-md border border-forest-200 bg-white px-2 py-1 text-sm text-forest-900 placeholder:text-forest-300 focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                            />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <!-- Error -->
            @if (errorMsg()) {
              <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p class="text-sm text-red-700">{{ errorMsg() }}</p>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="sticky bottom-0 flex items-center justify-end gap-3 border-t border-forest-100 bg-white px-6 py-4">
            <button
              type="button"
              (click)="cancel.emit()"
              class="rounded-lg border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50 transition"
              [disabled]="submitting()"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="onGenerar()"
              class="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50 transition"
              [disabled]="submitting() || !isFormValid()"
            >
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
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() facturaId = 0;
  @Input() facturaNumero = '';
  @Input() empresaNombre = '';
  @Input() montoTotal = 0;

  @Output() cancel = new EventEmitter<void>();
  @Output() generated = new EventEmitter<void>();

  productores = signal<ProductorOcRow[]>([]);
  loadingProductores = signal(false);
  submitting = signal(false);
  errorMsg = signal('');

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
      this.loadProductores();
    }
  }

  isFormValid(): boolean {
    return !!(
      this.formData.fecha_documento &&
      this.formData.fecha_contabilizacion &&
      this.formData.glosa_cabecera.trim()
    );
  }

  onGenerar(): void {
    if (!this.isFormValid() || this.submitting()) return;

    this.submitting.set(true);
    this.errorMsg.set('');

    const body: GenerarPlanillaRequest = {
      id_factura: this.facturaId,
      fecha_documento: this.formData.fecha_documento,
      fecha_contabilizacion: this.formData.fecha_contabilizacion,
      glosa_cabecera: this.formData.glosa_cabecera.trim(),
      temporada: this.formData.temporada.trim() || null,
      codigo_cargo_abono: this.formData.codigo_cargo_abono.trim() || null,
      glosa_cargo_abono: this.formData.glosa_cargo_abono.trim() || null,
      indicador_impuesto: this.formData.indicador_impuesto.trim() || undefined,
      productores_oc: this.productores().map((p) => ({
        id_productor: p.id_productor,
        orden_compra: p.orden_compra,
        posicion_oc: p.posicion_oc || undefined,
      })),
    };

    this.http
      .post<{ data: unknown }>(`/api/planillas-sap/generar`, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.generated.emit();
        },
        error: (err) => {
          this.submitting.set(false);
          const msg =
            err?.error?.message || err?.error?.error || 'Error al generar la planilla SAP.';
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
    this.productores.set([]);
    this.errorMsg.set('');
    this.submitting.set(false);
  }

  private loadProductores(): void {
    if (!this.facturaId) return;

    this.loadingProductores.set(true);

    this.api
      .getFacturaDetalle(this.facturaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const movs = res.data?.movimientos ?? [];
          const grouped = new Map<
            number,
            { codigo_proveedor: string; nombre: string; monto: number; especie: string | null }
          >();

          for (const m of movs) {
            const raw = m as unknown as Record<string, unknown>;
            const idProductor = (raw['id_productor'] as number) ?? 0;
            if (!idProductor) continue;

            const existing = grouped.get(idProductor);
            if (existing) {
              existing.monto += Number(raw['monto_aplicado']) || 0;
            } else {
              grouped.set(idProductor, {
                codigo_proveedor: String(raw['productor_codigo'] ?? ''),
                nombre: String(raw['productor_nombre'] ?? ''),
                monto: Number(raw['monto_aplicado']) || 0,
                especie: (raw['especie_nombre'] as string) ?? null,
              });
            }
          }

          const rows: ProductorOcRow[] = [];
          grouped.forEach((val, key) => {
            rows.push({
              id_productor: key,
              codigo_proveedor: val.codigo_proveedor,
              nombre: val.nombre,
              monto: val.monto,
              especie: val.especie,
              orden_compra: '',
              posicion_oc: '10',
            });
          });

          this.productores.set(rows);
          this.loadingProductores.set(false);
        },
        error: () => {
          this.loadingProductores.set(false);
          this.errorMsg.set('No se pudieron cargar los productores de esta pre factura.');
        },
      });
  }
}
