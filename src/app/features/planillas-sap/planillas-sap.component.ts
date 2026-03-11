
import { Component, OnInit, computed, signal } from '@angular/core';

import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

interface PlanillaPermissions {
  can_generate_planillas?: boolean;
}

interface PlanillaGrupo {
  group_key: string;
  periodo_label?: string;
  centro_costo?: string | null;
  centro_costo_codigo?: string | null;
  total_facturas?: number | string | null;
  total_folios?: number | string | null;
  monto_total?: number | string | null;
  empresas?: string[];
  facturas?: Array<Record<string, unknown>>;
}

interface PlanillasOverviewData {
  resumen: Record<string, unknown>;
  grupos: PlanillaGrupo[];
}

@Component({
    selector: 'app-planillas-sap',
    imports: [WorkspaceShellComponent],
    template: `
    <app-workspace-shell
      title="Planillas SAP"
      subtitle="Agrupación de facturas por período y centro de costo. La salida Excel queda preparada pero no se emite aún."
      activeSection="planillas"
    >
      <div class="space-y-6">
        <section class="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-sky-900">Generación de archivo pendiente</p>
              <p class="mt-1 text-xs text-sky-700">Esta vista ya consolida la base de datos como insumo; el Excel tipo se puede conectar sobre estos grupos después.</p>
            </div>
            @if (permissions()?.can_generate_planillas === false) {
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm">
                Sin permiso de generación
              </span>
            }
          </div>
        </section>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Grupos</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['grupos']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Agrupaciones período + centro de costo.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Facturas</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['facturas']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Cabeceras incluidas para consolidación.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Centros de costo</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['centros_costo']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Centros presentes en la consolidación actual.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Monto total</p>
            <p class="mt-3 text-3xl font-bold text-teal-700">{{ formatCurrency(overview()?.resumen?.['monto_total']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Suma total disponible para planilla SAP.</p>
          </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[24rem,1fr]">
          <div class="space-y-4">
            <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm font-semibold text-forest-900">Lotes disponibles</h2>
                  <p class="mt-1 text-xs text-forest-500">Cada lote representa una futura planilla SAP.</p>
                </div>
                <button type="button" (click)="loadOverview()" [disabled]="loading()" class="btn-ghost">
                  Actualizar
                </button>
              </div>

              <div class="mt-4 space-y-3">
                @if (loading()) {
                  <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                    Cargando agrupaciones...
                  </div>
                } @else if ((overview()?.grupos?.length ?? 0) === 0) {
                  <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                    No hay facturas registradas para consolidar en planilla SAP.
                  </div>
                } @else {
                  @for (group of overview()?.grupos ?? []; track group.group_key) {
                    <button
                      type="button"
                      (click)="selectGroup(group.group_key)"
                      class="block w-full rounded-2xl border px-4 py-4 text-left transition"
                      [class.border-forest-500]="selectedGroupKey() === group.group_key"
                      [class.bg-forest-50]="selectedGroupKey() === group.group_key"
                      [class.border-forest-100]="selectedGroupKey() !== group.group_key"
                      [class.hover:border-forest-300]="selectedGroupKey() !== group.group_key"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-semibold text-forest-900">
                            {{ group.centro_costo_codigo || 'CC' }} · {{ group.centro_costo || 'Sin centro de costo' }}
                          </p>
                          <p class="mt-1 text-xs text-forest-500">{{ group.periodo_label || 'Sin período' }}</p>
                        </div>
                        <span class="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                          {{ toNumber(group.total_facturas) }} fac.
                        </span>
                      </div>
                      <p class="mt-3 text-sm font-semibold text-teal-700">{{ formatCurrency(group.monto_total) }}</p>
                    </button>
                  }
                }
              </div>
            </div>
          </div>

          <div class="space-y-4">
            @if (selectedGroup()) {
              <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="text-lg font-semibold text-forest-900">
                      {{ selectedGroup()?.centro_costo_codigo || 'CC' }} · {{ selectedGroup()?.centro_costo || 'Centro de costo' }}
                    </h2>
                    <p class="mt-1 text-sm text-forest-500">{{ selectedGroup()?.periodo_label || 'Sin período' }}</p>
                  </div>
                  <div class="rounded-2xl border border-forest-100 bg-forest-50 px-4 py-3 text-right">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Total lote</p>
                    <p class="mt-1 text-2xl font-bold text-teal-700">{{ formatCurrency(selectedGroup()?.monto_total) }}</p>
                  </div>
                </div>

                <div class="mt-5 grid gap-4 md:grid-cols-3">
                  <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Facturas</p>
                    <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(selectedGroup()?.total_facturas) }}</p>
                  </article>
                  <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Folios</p>
                    <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(selectedGroup()?.total_folios) }}</p>
                  </article>
                  <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Empresas</p>
                    <p class="mt-2 text-xl font-bold text-forest-900">{{ selectedGroup()?.empresas?.length ?? 0 }}</p>
                  </article>
                </div>

                <div class="mt-5 rounded-2xl border border-forest-100 bg-white">
                  <div class="border-b border-forest-100 px-4 py-3">
                    <h3 class="text-sm font-semibold text-forest-900">Facturas incluidas</h3>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-forest-100 text-sm">
                      <thead>
                        <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                          <th class="px-4 py-3">Factura</th>
                          <th class="px-4 py-3">Folio</th>
                          <th class="px-4 py-3">Empresa</th>
                          <th class="px-4 py-3">Emisión</th>
                          <th class="px-4 py-3 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-forest-100">
                        @for (invoice of selectedGroup()?.facturas ?? []; track invoice['id_factura']) {
                          <tr>
                            <td class="px-4 py-3 font-medium text-forest-900">{{ invoice['numero_factura'] || 'Sin número' }}</td>
                            <td class="px-4 py-3 text-forest-600">{{ invoice['folio_numero'] || '-' }}</td>
                            <td class="px-4 py-3 text-forest-600">{{ invoice['empresa_nombre'] || 'Sin empresa' }}</td>
                            <td class="px-4 py-3 text-forest-600">{{ formatDate(invoice['fecha_emision']) }}</td>
                            <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(invoice['monto_total']) }}</td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="5" class="px-4 py-5 text-center text-sm text-forest-500">
                              No hay facturas asociadas a este lote.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            } @else {
              <div class="rounded-2xl border border-dashed border-forest-200 bg-white px-6 py-10 text-center shadow-sm">
                <p class="text-sm font-medium text-forest-700">Selecciona un lote para revisar la futura planilla SAP.</p>
              </div>
            }
          </div>
        </section>
      </div>
    </app-workspace-shell>
  `
})
export class PlanillasSapComponent implements OnInit {
  readonly loading = signal(false);
  readonly overview = signal<PlanillasOverviewData | null>(null);
  readonly permissions = signal<PlanillaPermissions | null>(null);
  readonly selectedGroupKey = signal<string | null>(null);

  readonly selectedGroup = computed<PlanillaGrupo | null>(() => {
    const data = this.overview();
    const key = this.selectedGroupKey();
    if (!data || !key) return null;
    return data.grupos.find((group) => group.group_key === key) ?? null;
  });

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading.set(true);

    this.cflApi.getPlanillasSapOverview().subscribe({
      next: (response) => {
        const data = response.data as PlanillasOverviewData;
        this.overview.set(data);
        this.permissions.set((response.permissions as PlanillaPermissions | undefined) ?? null);
        this.loading.set(false);

        const selected = this.selectedGroupKey();
        const exists = data.grupos.some((group) => group.group_key === selected);
        this.selectedGroupKey.set(exists ? selected : data.grupos[0]?.group_key ?? null);
      },
      error: () => {
        this.overview.set({ resumen: {}, grupos: [] });
        this.loading.set(false);
      },
    });
  }

  selectGroup(groupKey: string): void {
    this.selectedGroupKey.set(groupKey);
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
