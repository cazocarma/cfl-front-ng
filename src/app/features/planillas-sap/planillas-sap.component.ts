
import { TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { PlanillaSapListItem } from '../../core/models/planilla-sap.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';
import { GenerarPlanillaModalComponent } from './generar-planilla-modal.component';

interface PlanillaPermissions {
  can_generate_planillas?: boolean;
}

interface PlanillaGrupo {
  group_key: string;
  periodo_label?: string;
  empresa_nombre?: string | null;
  empresa_rut?: string | null;
  id_empresa?: number | null;
  total_facturas?: number | string | null;
  monto_total?: number | string | null;
  facturas?: Array<Record<string, unknown>>;
}

interface PlanillasOverviewData {
  resumen: Record<string, unknown>;
  grupos: PlanillaGrupo[];
}

@Component({
    selector: 'app-planillas-sap',
    imports: [RouterLink, WorkspaceShellComponent, GenerarPlanillaModalComponent, TitleCasePipe],
    template: `
    <app-workspace-shell
      title="Planillas SAP"
      subtitle="Generación de planillas SAP para contabilización de fletes."
      activeSection="planillas"
    >
      <div class="space-y-6">

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Grupos</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(overview()?.resumen?.['grupos']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Agrupaciones período + centro de costo.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Pre Facturas</p>
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
                    No hay pre facturas registradas para consolidar en planilla SAP.
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
                            {{ group.empresa_nombre || 'Sin empresa' }}
                          </p>
                          <p class="mt-1 text-xs text-forest-500">{{ group.periodo_label || 'Sin período' }}</p>
                        </div>
                        <span class="rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                          {{ toNumber(group.total_facturas) }} pre fac.
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
                      {{ selectedGroup()?.empresa_nombre || 'Sin empresa' }}
                    </h2>
                    <p class="mt-1 text-sm text-forest-500">{{ selectedGroup()?.periodo_label || 'Sin período' }}</p>
                  </div>
                  <div class="rounded-2xl border border-forest-100 bg-forest-50 px-4 py-3 text-right">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Total lote</p>
                    <p class="mt-1 text-2xl font-bold text-teal-700">{{ formatCurrency(selectedGroup()?.monto_total) }}</p>
                  </div>
                </div>

                <div class="mt-5 grid gap-4 md:grid-cols-2">
                  <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Pre Facturas</p>
                    <p class="mt-2 text-xl font-bold text-forest-900">{{ toNumber(selectedGroup()?.total_facturas) }}</p>
                  </article>
                  <article class="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Monto Total</p>
                    <p class="mt-2 text-xl font-bold text-teal-700">{{ formatCurrency(selectedGroup()?.monto_total) }}</p>
                  </article>
                </div>

                <div class="mt-5 rounded-2xl border border-forest-100 bg-white">
                  <div class="border-b border-forest-100 px-4 py-3">
                    <h3 class="text-sm font-semibold text-forest-900">Pre Facturas incluidas</h3>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-forest-100 text-sm">
                      <thead>
                        <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                          <th class="px-4 py-3">Pre Factura</th>
                          <th class="px-4 py-3">Empresa</th>
                          <th class="px-4 py-3">Emisión</th>
                          <th class="px-4 py-3 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-forest-100">
                        @for (invoice of selectedGroup()?.facturas ?? []; track invoice['id_factura']) {
                          <tr>
                            <td class="px-4 py-3 font-medium text-forest-900">{{ invoice['numero_factura'] || 'Sin número' }}</td>
                            <td class="px-4 py-3 text-forest-600">{{ invoice['empresa_nombre'] || 'Sin empresa' }}</td>
                            <td class="px-4 py-3 text-forest-600">{{ fmtDate(invoice['fecha_emision']) }}</td>
                            <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(invoice['monto_total']) }}</td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="4" class="px-4 py-5 text-center text-sm text-forest-500">
                              No hay pre facturas asociadas a este lote.
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Botón generar planilla por cada factura del grupo -->
                @if (permissions()?.can_generate_planillas !== false) {
                  <div class="mt-5">
                    <p class="text-xs text-forest-500 mb-3">Genera la planilla SAP para cada pre factura de este lote:</p>
                    <div class="flex flex-wrap gap-2">
                      @for (invoice of selectedGroup()?.facturas ?? []; track invoice['id_factura']) {
                        <button type="button"
                                (click)="abrirModalGenerar(invoice)"
                                class="rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition">
                          Generar {{ invoice['numero_factura'] || 'Planilla' }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="rounded-2xl border border-dashed border-forest-200 bg-white px-6 py-10 text-center shadow-sm">
                <p class="text-sm font-medium text-forest-700">Selecciona un lote para revisar la futura planilla SAP.</p>
              </div>
            }
          </div>
        </section>

        <!-- Planillas generadas -->
        <section class="rounded-2xl border border-forest-100 bg-white shadow-sm">
          <div class="border-b border-forest-100 px-5 py-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-forest-900">Planillas SAP generadas</h2>
            <button type="button" (click)="loadPlanillas()" class="text-xs text-forest-500 hover:text-forest-800">
              Actualizar
            </button>
          </div>
          @if (planillas().length === 0) {
            <div class="px-5 py-8 text-center text-sm text-forest-500">
              No se han generado planillas SAP aún.
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-4 py-3">Pre Factura</th>
                    <th class="px-4 py-3">Empresa</th>
                    <th class="px-4 py-3">Glosa</th>
                    <th class="px-4 py-3 text-center">Docs</th>
                    <th class="px-4 py-3 text-right">Monto</th>
                    <th class="px-4 py-3">Estado</th>
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (p of planillas(); track p.id_planilla_sap) {
                    <tr class="hover:bg-forest-50 transition">
                      <td class="px-4 py-3 font-semibold text-forest-900">{{ p.numero_factura }}</td>
                      <td class="px-4 py-3 text-forest-700">{{ p.empresa_nombre }}</td>
                      <td class="px-4 py-3 text-forest-600 text-xs">{{ p.glosa_cabecera }}</td>
                      <td class="px-4 py-3 text-center text-forest-800">{{ p.total_documentos }}</td>
                      <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ fmtCLP(p.monto_total) }}</td>
                      <td class="px-4 py-3">
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              [class.bg-slate-100]="p.estado === 'generada'" [class.text-slate-700]="p.estado === 'generada'"
                              [class.bg-blue-100]="p.estado === 'descargada'" [class.text-blue-700]="p.estado === 'descargada'"
                              [class.bg-green-100]="p.estado === 'contabilizada'" [class.text-green-700]="p.estado === 'contabilizada'">
                          {{ p.estado | titlecase }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-forest-600 text-xs">{{ fmtDate(p.fecha_creacion) }}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <a [routerLink]="['/planillas-sap', p.id_planilla_sap]"
                             class="text-xs font-semibold text-forest-600 hover:text-forest-900">Ver</a>
                          <button type="button" (click)="descargarPlanilla(p)"
                                  class="text-xs font-semibold text-teal-600 hover:text-teal-900">Excel</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>

      <!-- Modal generar planilla -->
      @if (modalOpen()) {
        <app-generar-planilla-modal
          [open]="modalOpen()"
          [facturaId]="modalFacturaId()"
          [facturaNumero]="modalFacturaNumero()"
          [empresaNombre]="modalEmpresaNombre()"
          [montoTotal]="modalMontoTotal()"
          (cancel)="modalOpen.set(false)"
          (generated)="onPlanillaGenerada()" />
      }

    </app-workspace-shell>
  `
})
export class PlanillasSapComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly overview = signal<PlanillasOverviewData | null>(null);
  readonly permissions = signal<PlanillaPermissions | null>(null);
  readonly selectedGroupKey = signal<string | null>(null);
  readonly planillas = signal<PlanillaSapListItem[]>([]);

  // Modal state
  readonly modalOpen          = signal(false);
  readonly modalFacturaId     = signal(0);
  readonly modalFacturaNumero = signal('');
  readonly modalEmpresaNombre = signal('');
  readonly modalMontoTotal    = signal(0);

  readonly selectedGroup = computed<PlanillaGrupo | null>(() => {
    const data = this.overview();
    const key = this.selectedGroupKey();
    if (!data || !key) return null;
    return data.grupos.find((group) => group.group_key === key) ?? null;
  });

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.loadOverview();
    this.loadPlanillas();
  }

  loadOverview(): void {
    this.loading.set(true);
    this.cflApi.getPlanillasSapOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  loadPlanillas(): void {
    this.cflApi.getPlanillasSapList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.planillas.set(res.data),
        error: () => this.planillas.set([]),
      });
  }

  selectGroup(groupKey: string): void {
    this.selectedGroupKey.set(groupKey);
  }

  abrirModalGenerar(invoice: Record<string, unknown>): void {
    this.modalFacturaId.set(Number(invoice['id_factura']) || 0);
    this.modalFacturaNumero.set(String(invoice['numero_factura'] || ''));
    this.modalEmpresaNombre.set(String(invoice['empresa_nombre'] || ''));
    this.modalMontoTotal.set(Number(invoice['monto_total']) || 0);
    this.modalOpen.set(true);
  }

  onPlanillaGenerada(): void {
    this.modalOpen.set(false);
    this.loadPlanillas();
    this.loadOverview();
  }

  descargarPlanilla(p: PlanillaSapListItem): void {
    this.cflApi.exportarPlanillaSap(p.id_planilla_sap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => triggerDownload(blob, `planilla-sap-${p.numero_factura}.xlsx`),
        error: () => {},
      });
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  formatCurrency(value: unknown): string { return formatCLP(this.toNumber(value)); }
  readonly fmtCLP  = formatCLP;
  readonly fmtDate = formatDate;
}
