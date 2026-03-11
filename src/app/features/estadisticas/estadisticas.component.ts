
import { Component, OnInit, signal } from '@angular/core';

import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

interface EstadisticasOverviewData {
  resumen: Record<string, unknown>;
  estados: Array<Record<string, unknown>>;
  transportistas: Array<Record<string, unknown>>;
  centros_costo: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
}

@Component({
    selector: 'app-estadisticas',
    imports: [WorkspaceShellComponent],
    template: `
    <app-workspace-shell
      title="Estadísticas"
      subtitle="Resumen operativo y financiero construido desde cabeceras de flete, folios y facturas."
      activeSection="estadisticas"
    >
      <div class="space-y-6">
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Fletes</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['total_fletes']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Total de cabeceras registradas.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Asignado Folio</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['fletes_asignado_folio']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Base disponible para facturación.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Facturas</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['facturas_registradas']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Cabeceras de factura existentes.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Monto Facturado</p>
            <p class="mt-3 text-3xl font-bold text-teal-700">{{ formatCurrency(data()?.resumen?.['monto_facturado']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Suma de montos totales facturados.</p>
          </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-forest-900">Distribución por estado</h2>
                <p class="mt-1 text-xs text-forest-500">Cantidad y monto agrupados por estado del ciclo de vida.</p>
              </div>
              <button type="button" (click)="load()" [disabled]="loading()" class="btn-ghost">
                Actualizar
              </button>
            </div>

            <div class="mt-5 space-y-4">
              @if (loading()) {
                <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                  Cargando indicadores...
                </div>
              } @else if ((data()?.estados?.length ?? 0) === 0) {
                <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                  No hay movimientos suficientes para construir distribución.
                </div>
              } @else {
                @for (row of data()?.estados ?? []; track row['estado']) {
                  <div>
                    <div class="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-forest-900">{{ row['estado'] }}</p>
                        <p class="text-xs text-forest-500">{{ formatCurrency(row['monto']) }}</p>
                      </div>
                      <span class="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                        {{ toNumber(row['total']) }}
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-forest-100">
                      <div
                        class="h-2 rounded-full bg-gradient-to-r from-forest-500 to-teal-500"
                        [style.width.%]="percentageOfState(row['total'])"
                      ></div>
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900">Señales rápidas</h2>
            <div class="mt-4 space-y-4">
              <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">En revisión</p>
                <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['fletes_en_revision']) }}</p>
              </div>
              <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Facturados</p>
                <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['fletes_facturados']) }}</p>
              </div>
              <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Folios abiertos</p>
                <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['folios_abiertos']) }}</p>
              </div>
              <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Ticket promedio factura</p>
                <p class="mt-2 text-xl font-bold text-forest-900">{{ formatCurrency(data()?.resumen?.['ticket_promedio_factura']) }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-2">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900">Top transportistas</h2>
            <p class="mt-1 text-xs text-forest-500">Ranking por monto acumulado en cabeceras de flete.</p>

            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-4 py-3">Transportista</th>
                    <th class="px-4 py-3 text-right">Movs.</th>
                    <th class="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (row of data()?.transportistas ?? []; track $index) {
                    <tr>
                      <td class="px-4 py-3 font-medium text-forest-900">{{ row['empresa_nombre'] || 'Sin transportista' }}</td>
                      <td class="px-4 py-3 text-right text-forest-600">{{ toNumber(row['total_movimientos']) }}</td>
                      <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(row['monto_total']) }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="px-4 py-5 text-center text-sm text-forest-500">
                        Sin datos de transportistas aún.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900">Top centros de costo</h2>
            <p class="mt-1 text-xs text-forest-500">Ranking por monto acumulado de movimientos.</p>

            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-4 py-3">Centro de costo</th>
                    <th class="px-4 py-3 text-right">Movs.</th>
                    <th class="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (row of data()?.centros_costo ?? []; track row['id_centro_costo']) {
                    <tr>
                      <td class="px-4 py-3 font-medium text-forest-900">
                        {{ row['sap_codigo'] || 'CC' }} · {{ row['nombre'] || 'Sin nombre' }}
                      </td>
                      <td class="px-4 py-3 text-right text-forest-600">{{ toNumber(row['total_movimientos']) }}</td>
                      <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(row['monto_total']) }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="px-4 py-5 text-center text-sm text-forest-500">
                        Sin datos de centros de costo aún.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-semibold text-forest-900">Línea de tiempo reciente</h2>
          <p class="mt-1 text-xs text-forest-500">Últimos períodos con movimientos y facturas detectadas.</p>

          <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            @for (row of data()?.timeline ?? []; track row['periodo']) {
              <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-forest-900">{{ row['periodo'] || 'Sin período' }}</p>
                  <span class="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-forest-700 shadow-sm">
                    {{ toNumber(row['total_fletes']) }} mov.
                  </span>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p class="text-[11px] uppercase tracking-[0.18em] text-forest-500">Monto movs.</p>
                    <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatCurrency(row['monto_movimientos']) }}</p>
                  </div>
                  <div>
                    <p class="text-[11px] uppercase tracking-[0.18em] text-forest-500">Facturas</p>
                    <p class="mt-1 text-sm font-semibold text-forest-900">{{ toNumber(row['total_facturas']) }}</p>
                  </div>
                </div>
              </article>
            } @empty {
              <div class="rounded-2xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                No hay períodos suficientes para construir línea de tiempo.
              </div>
            }
          </div>
        </section>
      </div>
    </app-workspace-shell>
  `
})
export class EstadisticasComponent implements OnInit {
  readonly loading = signal(false);
  readonly data = signal<EstadisticasOverviewData | null>(null);

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.cflApi.getEstadisticasOverview().subscribe({
      next: (response) => {
        this.data.set(response.data as EstadisticasOverviewData);
        this.loading.set(false);
      },
      error: () => {
        this.data.set({
          resumen: {},
          estados: [],
          transportistas: [],
          centros_costo: [],
          timeline: [],
        });
        this.loading.set(false);
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

  percentageOfState(value: unknown): number {
    const rows = this.data()?.estados ?? [];
    const max = Math.max(...rows.map((row) => this.toNumber(row['total'])), 0);
    if (max <= 0) return 0;
    return Math.round((this.toNumber(value) / max) * 100);
  }
}
