import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';

import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

interface FacturasPermissions {
  can_edit_facturas?: boolean;
  can_generate_planillas?: boolean;
}

interface FacturaListItem {
  id_factura: number | string;
  id_folio: number | string;
  folio_numero: string;
  empresa_nombre?: string | null;
  numero_factura?: string | null;
  fecha_emision?: string | Date | null;
  moneda?: string | null;
  monto_total?: number | string | null;
  estado?: string | null;
  centro_costo?: string | null;
  centro_costo_codigo?: string | null;
}

interface FacturaFolioItem {
  id_folio: number | string;
  folio_numero: string;
  id_factura_existente?: number | string | null;
  numero_factura_existente?: string | null;
  estado_factura_existente?: string | null;
  centro_costo?: string | null;
  centro_costo_codigo?: string | null;
  monto_neto_estimado?: number | string | null;
  total_movimientos?: number | string | null;
}

interface FacturasOverviewData {
  resumen: Record<string, unknown>;
  facturas: FacturaListItem[];
  folios_disponibles: FacturaFolioItem[];
}

interface FacturaPreviewData {
  source: string;
  folio: Record<string, unknown> | null;
  cabecera: Record<string, unknown> | null;
  detalle: Array<Record<string, unknown>>;
  movimientos: Array<Record<string, unknown>>;
  resumen: Record<string, unknown>;
}

interface SelectorItem {
  id_folio: number;
  folio_numero: string;
  label: string;
  subtitle: string;
  amount: number;
}

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, WorkspaceShellComponent],
  template: `
    <app-workspace-shell
      title="Facturas"
      subtitle="Cabecera y detalle desde la BD, con fallback a folios en estado ASIGNADO_FOLIO."
      activeSection="facturas"
    >
      <div class="space-y-6">
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Facturas</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['facturas_registradas']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Registros existentes en cabecera factura.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Folios Elegibles</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['folios_elegibles']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Con movimientos en estado ASIGNADO_FOLIO.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Pendientes</p>
            <p class="mt-3 text-3xl font-bold text-amber-700">{{ toNumber(overview()?.resumen?.['folios_pendientes_factura']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Folios aún sin cabecera de factura registrada.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Monto Facturado</p>
            <p class="mt-3 text-3xl font-bold text-teal-700">{{ formatCurrency(overview()?.resumen?.['monto_facturado']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Suma del monto total registrado en cabecera factura.</p>
          </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[23rem,1fr]">
          <div class="space-y-4">
            <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm font-semibold text-forest-900">Explorador de folios</h2>
                  <p class="mt-1 text-xs text-forest-500">Selecciona un folio y se rellena desde factura existente o borrador estimado.</p>
                </div>
                <button
                  type="button"
                  (click)="loadOverview()"
                  [disabled]="loadingOverview()"
                  class="btn-ghost"
                >
                  Actualizar
                </button>
              </div>

              <div class="mt-4 rounded-xl border border-forest-100 bg-forest-50 p-3">
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  Folio de trabajo
                </label>
                <select
                  [value]="selectedFolioId() ?? ''"
                  (change)="onSelectFolio($any($event.target).value)"
                  class="w-full rounded-xl border border-forest-200 bg-white px-3 py-2.5 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                >
                  <option value="">Seleccionar folio...</option>
                  @for (item of selectableFolios(); track item.id_folio) {
                    <option [value]="item.id_folio">{{ item.label }}</option>
                  }
                </select>
              </div>

              @if (permissions()?.can_edit_facturas === false) {
                <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  La vista está disponible, pero este perfil no tiene permiso de edición para facturas.
                </div>
              }
            </div>

            <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
              <h3 class="text-sm font-semibold text-forest-900">Disponibles</h3>
              <p class="mt-1 text-xs text-forest-500">Facturas registradas y folios elegibles para generar factura.</p>

              <div class="mt-4 space-y-3">
                @if (loadingOverview()) {
                  <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                    Cargando datos...
                  </div>
                } @else if (selectableFolios().length === 0) {
                  <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                    No hay facturas ni folios en estado ASIGNADO_FOLIO disponibles todavia.
                  </div>
                } @else {
                  @for (item of selectableFolios(); track item.id_folio) {
                    <button
                      type="button"
                      (click)="setSelectedFolio(item.id_folio)"
                      class="block w-full rounded-2xl border px-4 py-4 text-left transition"
                      [class.border-forest-500]="selectedFolioId() === item.id_folio"
                      [class.bg-forest-50]="selectedFolioId() === item.id_folio"
                      [class.shadow-sm]="selectedFolioId() === item.id_folio"
                      [class.border-forest-100]="selectedFolioId() !== item.id_folio"
                      [class.hover:border-forest-300]="selectedFolioId() !== item.id_folio"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-semibold text-forest-900">{{ item.label }}</p>
                          <p class="mt-1 text-xs text-forest-500">{{ item.subtitle }}</p>
                        </div>
                        <span class="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                          {{ formatCurrency(item.amount) }}
                        </span>
                      </div>
                    </button>
                  }
                }
              </div>
            </div>
          </div>

          <div class="space-y-4">
            @if (previewLoading()) {
              <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center shadow-sm">
                <p class="text-sm font-medium text-forest-600">Cargando cabecera y detalle...</p>
              </div>
            } @else if (previewError()) {
              <div class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                {{ previewError() }}
              </div>
            } @else if (preview()) {
              <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            [class.bg-forest-100]="preview()?.source === 'database'"
                            [class.text-forest-700]="preview()?.source === 'database'"
                            [class.bg-amber-100]="preview()?.source !== 'database'"
                            [class.text-amber-700]="preview()?.source !== 'database'">
                        {{ preview()?.source === 'database' ? 'Desde BD' : 'Borrador estimado' }}
                      </span>
                      <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        Folio {{ preview()?.folio?.['folio_numero'] ?? '-' }}
                      </span>
                    </div>
                    <h2 class="mt-3 text-lg font-semibold text-forest-900">
                      {{ preview()?.cabecera?.['numero_factura'] || 'Factura sin número definitivo' }}
                    </h2>
                    <p class="mt-1 text-sm text-forest-500">
                      {{ preview()?.cabecera?.['empresa_nombre'] || 'Empresa por definir' }}
                    </p>
                  </div>

                  <div class="rounded-2xl border border-forest-100 bg-forest-50 px-4 py-3 text-right">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Total</p>
                    <p class="mt-1 text-2xl font-bold text-teal-700">{{ formatCurrency(preview()?.resumen?.['monto_total']) }}</p>
                  </div>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Centro de costo</p>
                    <p class="mt-2 text-sm font-semibold text-forest-900">
                      {{ preview()?.folio?.['centro_costo_codigo'] || 'Sin código' }} · {{ preview()?.folio?.['centro_costo'] || 'Sin centro de costo' }}
                    </p>
                  </div>

                  <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Fecha emisión</p>
                    <p class="mt-2 text-sm font-semibold text-forest-900">{{ formatDate(preview()?.cabecera?.['fecha_emision']) }}</p>
                  </div>

                  <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Estado</p>
                    <p class="mt-2 text-sm font-semibold text-forest-900">{{ preview()?.cabecera?.['estado'] || '-' }}</p>
                  </div>

                  <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Moneda</p>
                    <p class="mt-2 text-sm font-semibold text-forest-900">{{ preview()?.cabecera?.['moneda'] || 'CLP' }}</p>
                  </div>
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Neto</p>
                  <p class="mt-3 text-2xl font-bold text-forest-900">{{ formatCurrency(preview()?.resumen?.['monto_neto']) }}</p>
                </article>
                <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">IVA</p>
                  <p class="mt-3 text-2xl font-bold text-forest-900">{{ formatCurrency(preview()?.resumen?.['monto_iva']) }}</p>
                </article>
                <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Movimientos Base</p>
                  <p class="mt-3 text-2xl font-bold text-forest-900">{{ toNumber(preview()?.resumen?.['total_movimientos']) }}</p>
                </article>
              </div>

              <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-semibold text-forest-900">Movimientos considerados</h3>
                    <p class="mt-1 text-xs text-forest-500">Base de facturación para el folio seleccionado.</p>
                  </div>
                  <span class="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                    {{ toNumber(preview()?.movimientos?.length) }} filas
                  </span>
                </div>

                <div class="mt-4 overflow-x-auto">
                  <table class="min-w-full divide-y divide-forest-100 text-sm">
                    <thead>
                      <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                        <th class="px-3 py-3">Movimiento</th>
                        <th class="px-3 py-3">Ruta</th>
                        <th class="px-3 py-3">Transportista</th>
                        <th class="px-3 py-3">Fecha</th>
                        <th class="px-3 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-100">
                      @for (row of preview()?.movimientos ?? []; track row['id_cabecera_flete']) {
                        <tr>
                          <td class="px-3 py-3 font-medium text-forest-900">
                            #{{ row['id_cabecera_flete'] }} · {{ row['numero_entrega'] || row['sap_numero_entrega'] || 'Sin entrega' }}
                          </td>
                          <td class="px-3 py-3 text-forest-600">{{ row['ruta'] || 'Sin ruta' }}</td>
                          <td class="px-3 py-3 text-forest-600">{{ row['transportista'] || 'Sin transportista' }}</td>
                          <td class="px-3 py-3 text-forest-600">{{ formatDate(row['fecha_salida']) }}</td>
                          <td class="px-3 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(row['monto_aplicado']) }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="5" class="px-3 py-5 text-center text-sm text-forest-500">
                            No hay movimientos disponibles para este folio.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-semibold text-forest-900">Detalle factura</h3>
                    <p class="mt-1 text-xs text-forest-500">Desde detalle de factura o generado como fallback desde los fletes del folio.</p>
                  </div>
                  <span class="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                    {{ toNumber(preview()?.detalle?.length) }} líneas
                  </span>
                </div>

                <div class="mt-4 space-y-3">
                  @for (row of preview()?.detalle ?? []; track $index) {
                    <div class="rounded-2xl border border-forest-100 bg-forest-50 px-4 py-4">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-medium text-forest-900">{{ row['detalle'] || 'Detalle sin descripción' }}</p>
                          @if (row['id_cabecera_flete']) {
                            <p class="mt-1 text-xs text-forest-500">Relacionado al flete #{{ row['id_cabecera_flete'] }}</p>
                          }
                        </div>
                        <span class="text-sm font-semibold text-forest-900">{{ formatCurrency(row['monto_linea']) }}</span>
                      </div>
                    </div>
                  } @empty {
                    <div class="rounded-2xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                      No hay detalle registrado ni movimientos elegibles para construir un borrador.
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="rounded-2xl border border-dashed border-forest-200 bg-white px-6 py-10 text-center shadow-sm">
                <p class="text-sm font-medium text-forest-700">Selecciona un folio para ver su cabecera y detalle.</p>
                <p class="mt-2 text-xs text-forest-500">Si existe factura, se mostrará desde BD. Si no, se proyectará un borrador con fallback.</p>
              </div>
            }
          </div>
        </section>
      </div>
    </app-workspace-shell>
  `,
})
export class FacturasComponent implements OnInit {
  readonly loadingOverview = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal('');
  readonly overview = signal<FacturasOverviewData | null>(null);
  readonly preview = signal<FacturaPreviewData | null>(null);
  readonly permissions = signal<FacturasPermissions | null>(null);
  readonly selectedFolioId = signal<number | null>(null);

  readonly selectableFolios = computed<SelectorItem[]>(() => {
    const data = this.overview();
    if (!data) return [];

    const merged = new Map<number, SelectorItem>();

    for (const factura of data.facturas || []) {
      const idFolio = this.toNumber(factura.id_folio);
      if (!idFolio || merged.has(idFolio)) continue;

      merged.set(idFolio, {
        id_folio: idFolio,
        folio_numero: String(factura.folio_numero || idFolio),
        label: `Folio ${factura.folio_numero} · ${factura.numero_factura || 'Factura registrada'}`,
        subtitle: `${factura.centro_costo_codigo || 'CC'} · ${factura.centro_costo || 'Centro de costo'} · ${factura.estado || 'Sin estado'}`,
        amount: this.toNumber(factura.monto_total),
      });
    }

    for (const folio of data.folios_disponibles || []) {
      const idFolio = this.toNumber(folio.id_folio);
      if (!idFolio || merged.has(idFolio)) continue;

      const baseLabel = folio.id_factura_existente
        ? `Folio ${folio.folio_numero} · ${folio.numero_factura_existente || 'Factura existente'}`
        : `Folio ${folio.folio_numero} · Pendiente de facturar`;

      merged.set(idFolio, {
        id_folio: idFolio,
        folio_numero: String(folio.folio_numero || idFolio),
        label: baseLabel,
        subtitle: `${folio.centro_costo_codigo || 'CC'} · ${folio.centro_costo || 'Centro de costo'} · ${this.toNumber(folio.total_movimientos)} movimientos`,
        amount: this.toNumber(folio.monto_neto_estimado),
      });
    }

    return Array.from(merged.values());
  });

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loadingOverview.set(true);

    this.cflApi.getFacturasOverview().subscribe({
      next: (response) => {
        const data = response.data as FacturasOverviewData;
        const permissions = (response.permissions as FacturasPermissions | undefined) ?? null;

        this.overview.set(data);
        this.permissions.set(permissions);
        this.loadingOverview.set(false);

        const availableIds = new Set(this.selectableFolios().map((item) => item.id_folio));
        const current = this.selectedFolioId();
        const nextId = current && availableIds.has(current)
          ? current
          : this.selectableFolios()[0]?.id_folio ?? null;

        if (nextId) {
          this.setSelectedFolio(nextId, true);
        } else {
          this.selectedFolioId.set(null);
          this.preview.set(null);
        }
      },
      error: (err) => {
        this.loadingOverview.set(false);
        this.previewError.set(err?.error?.error ?? 'No se pudo cargar la pantalla de facturas.');
      },
    });
  }

  onSelectFolio(rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.selectedFolioId.set(null);
      this.preview.set(null);
      return;
    }

    this.setSelectedFolio(parsed);
  }

  setSelectedFolio(idFolio: number, force = false): void {
    if (!force && this.selectedFolioId() === idFolio && this.preview()) {
      return;
    }

    this.selectedFolioId.set(idFolio);
    this.previewError.set('');
    this.previewLoading.set(true);

    this.cflApi.getFacturaPreviewByFolio(idFolio).subscribe({
      next: (response) => {
        this.preview.set(response.data as FacturaPreviewData);
        this.previewLoading.set(false);
      },
      error: (err) => {
        this.preview.set(null);
        this.previewLoading.set(false);
        this.previewError.set(err?.error?.error ?? 'No se pudo cargar el detalle del folio.');
      },
    });
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  formatCurrency(value: unknown): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(this.toNumber(value));
  }

  formatDate(value: unknown): string {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
