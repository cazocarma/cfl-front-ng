
import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { PlanillaSapListItem } from '../../core/models/planilla-sap.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { DisabledIfNoPermissionDirective } from '../../core/directives/disabled-if-no-permission.directive';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';
import { GenerarPlanillaModalComponent } from './generar-planilla-modal.component';

interface PlanillaPermissions {
  can_generate_planillas?: boolean;
}

interface FacturaDisponible {
  id_factura: number;
  numero_factura: string;
  empresa_nombre: string;
  fecha_emision: string;
  monto_total: number;
  selected: boolean;
}

@Component({
    selector: 'app-planillas-sap',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, WorkspaceShellComponent, GenerarPlanillaModalComponent, TitleCasePipe, DisabledIfNoPermissionDirective],
    template: `
    <app-workspace-shell
      title="Planillas SAP"
      subtitle="Generación de planillas SAP para contabilización de fletes."
      activeSection="planillas"
    >
      <div class="space-y-6">

        <!-- KPIs -->
        <section class="grid gap-4 md:grid-cols-3">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Pre Facturas disponibles</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ facturasDisponibles().length }}</p>
          </article>
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Seleccionadas</p>
            <p class="mt-3 text-3xl font-bold text-teal-700">{{ selectedCount() }}</p>
          </article>
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Monto selección</p>
            <p class="mt-3 text-3xl font-bold text-teal-700">{{ formatCurrency(selectedTotal()) }}</p>
          </article>
        </section>

        <!-- Pre Facturas disponibles -->
        <section class="rounded-2xl border border-forest-100 bg-white shadow-sm">
          <div class="border-b border-forest-100 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold text-forest-900">Pre Facturas disponibles para planilla SAP</h2>
              <p class="mt-0.5 text-xs text-forest-500">Pre facturas recibidas aún no incluidas en una planilla.</p>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" (click)="loadData()" [disabled]="loading()"
                      class="text-xs text-forest-500 hover:text-forest-800">Actualizar</button>
              @if (permissions()?.can_generate_planillas !== false) {
                <button type="button"
                        (click)="abrirModalGenerar()"
                        [disabled]="selectedCount() === 0"
                        [disabledIfNoPermission]="'planillas.generar'"
                        class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition disabled:opacity-50">
                  Generar Planilla SAP ({{ selectedCount() }})
                </button>
              }
            </div>
          </div>

          @if (loading()) {
            <div class="px-6 py-10 text-center text-sm text-forest-500">Cargando pre facturas...</div>
          } @else if (facturasDisponibles().length === 0) {
            <div class="px-6 py-10 text-center text-sm text-forest-500">
              No hay pre facturas recibidas disponibles para consolidar en planilla SAP.
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-3 py-3 w-10">
                      <input type="checkbox" [checked]="allSelected()" (change)="toggleAll()"
                             class="rounded border-forest-300" />
                    </th>
                    <th class="px-3 py-3">Pre Factura</th>
                    <th class="px-3 py-3">Empresa</th>
                    <th class="px-3 py-3">Emisión</th>
                    <th class="px-3 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (fac of facturasDisponibles(); track fac.id_factura) {
                    <tr class="transition hover:bg-forest-50" [class.opacity-40]="!fac.selected">
                      <td class="px-3 py-3">
                        <input type="checkbox" [checked]="fac.selected" (change)="toggleFactura(fac)"
                               class="rounded border-forest-300" />
                      </td>
                      <td class="px-3 py-3 font-medium text-forest-900">{{ fac.numero_factura }}</td>
                      <td class="px-3 py-3 text-forest-600">{{ fac.empresa_nombre }}</td>
                      <td class="px-3 py-3 text-forest-600">{{ fmtDate(fac.fecha_emision) }}</td>
                      <td class="px-3 py-3 text-right font-semibold text-forest-900">{{ formatCurrency(fac.monto_total) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="border-t border-forest-100 px-4 py-2 flex items-center justify-between">
              <span class="text-xs text-forest-500">{{ facturasDisponibles().length }} pre factura(s)</span>
              <button type="button" (click)="toggleAll()" class="text-xs font-semibold text-forest-600 hover:text-forest-900">
                {{ allSelected() ? 'Deseleccionar todas' : 'Seleccionar todas' }}
              </button>
            </div>
          }
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
                    <th class="px-4 py-3">Período</th>
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
                      <td class="px-4 py-3 font-semibold text-forest-900">{{ p.periodo_label || '-' }}</td>
                      <td class="px-4 py-3 text-forest-700">{{ p.empresas_nombres || '-' }}</td>
                      <td class="px-4 py-3 text-forest-600 text-xs">{{ p.glosa_cabecera }}</td>
                      <td class="px-4 py-3 text-center text-forest-800">{{ p.total_documentos }}</td>
                      <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ fmtCLP(p.monto_total) }}</td>
                      <td class="px-4 py-3">
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              [class.bg-slate-100]="p.estado === 'generada'" [class.text-slate-700]="p.estado === 'generada'"
                              [class.bg-green-100]="p.estado === 'enviada'" [class.text-green-700]="p.estado === 'enviada'"
                              [class.bg-red-100]="p.estado === 'anulada'" [class.text-red-700]="p.estado === 'anulada'">
                          {{ p.estado | titlecase }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-forest-600 text-xs">{{ fmtDate(p.fecha_creacion) }}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          @if (p.estado === 'generada') {
                            <a [routerLink]="['/planillas-sap', p.id_planilla_sap]"
                               class="text-xs font-semibold text-forest-600 hover:text-forest-900">Editar</a>
                          }
                          @if (p.estado !== 'anulada') {
                            <button type="button" (click)="descargarPlanilla(p)"
                                    class="text-xs font-semibold text-teal-600 hover:text-teal-900">Excel</button>
                          }
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
          [facturasIds]="modalFacturasIds()"
          (cancel)="modalOpen.set(false)"
          (generated)="onPlanillaGenerada()" />
      }

    </app-workspace-shell>
  `
})
export class PlanillasSapComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly permissions = signal<PlanillaPermissions | null>(null);
  readonly planillas = signal<PlanillaSapListItem[]>([]);
  readonly facturasDisponibles = signal<FacturaDisponible[]>([]);
  private selectionVersion = signal(0);

  readonly modalOpen        = signal(false);
  readonly modalFacturasIds = signal<number[]>([]);

  readonly selectedCount = computed(() => {
    this.selectionVersion();
    return this.facturasDisponibles().filter(f => f.selected).length;
  });

  readonly selectedTotal = computed(() => {
    this.selectionVersion();
    return this.facturasDisponibles()
      .filter(f => f.selected)
      .reduce((s, f) => s + (Number.isFinite(f.monto_total) ? f.monto_total : 0), 0);
  });

  readonly allSelected = computed(() => {
    this.selectionVersion();
    const facs = this.facturasDisponibles();
    return facs.length > 0 && facs.every(f => f.selected);
  });

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.loadData();
    this.loadPlanillas();
  }

  loadData(): void {
    this.loading.set(true);
    this.cflApi.getPlanillasSapOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response.data as { facturas?: Array<Record<string, unknown>> };
          this.permissions.set((response.permissions as PlanillaPermissions | undefined) ?? null);
          const raw = data?.facturas ?? [];
          this.facturasDisponibles.set(raw.map(f => ({
            id_factura: Number(f['id_factura']),
            numero_factura: String(f['numero_factura'] || ''),
            empresa_nombre: String(f['empresa_nombre'] || ''),
            fecha_emision: String(f['fecha_emision'] || ''),
            monto_total: Number(f['monto_total'] || 0),
            selected: false,
          })));
          this.selectionVersion.update(v => v + 1);
          this.loading.set(false);
        },
        error: () => {
          this.facturasDisponibles.set([]);
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

  toggleFactura(fac: FacturaDisponible): void {
    fac.selected = !fac.selected;
    this.selectionVersion.update(v => v + 1);
  }

  toggleAll(): void {
    const newState = !this.allSelected();
    for (const f of this.facturasDisponibles()) f.selected = newState;
    this.selectionVersion.update(v => v + 1);
  }

  abrirModalGenerar(): void {
    const ids = this.facturasDisponibles().filter(f => f.selected).map(f => f.id_factura).filter(n => n > 0);
    if (ids.length === 0) return;
    this.modalFacturasIds.set(ids);
    this.modalOpen.set(true);
  }

  onPlanillaGenerada(): void {
    this.modalOpen.set(false);
    this.loadPlanillas();
    this.loadData();
  }

  descargarPlanilla(p: PlanillaSapListItem): void {
    this.cflApi.exportarPlanillaSap(p.id_planilla_sap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const label = (p.periodo_label || String(p.id_planilla_sap)).replace(/\s+/g, '-');
          triggerDownload(blob, `planilla-sap-${label}.xlsx`);
        },
        error: () => {},
      });
  }

  formatCurrency(value: unknown): string {
    const n = Number(value);
    return formatCLP(Number.isFinite(n) ? n : 0);
  }
  readonly fmtCLP  = formatCLP;
  readonly fmtDate = formatDate;
}
