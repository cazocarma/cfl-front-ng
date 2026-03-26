import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PlanillaSapDetalle } from '../../core/models/planilla-sap.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

const ESTADO_LABELS: Record<string, string> = {
  generada: 'Generada',
  descargada: 'Descargada',
  contabilizada: 'Contabilizada',
};

const ESTADO_CHIP: Record<string, string> = {
  generada: 'bg-slate-100 text-slate-700',
  descargada: 'bg-blue-100 text-blue-700',
  contabilizada: 'bg-green-100 text-green-700',
};

@Component({
  selector: 'app-planilla-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, WorkspaceShellComponent],
  template: `
    <app-workspace-shell
      [title]="planilla() ? 'Planilla SAP — ' + planilla()!.numero_factura : 'Detalle Planilla SAP'"
      subtitle="Detalle de la planilla SAP generada con sus documentos y líneas."
      activeSection="planillas">

      <!-- Breadcrumb -->
      <div class="mb-4 flex items-center gap-2 text-sm text-forest-500">
        <a routerLink="/planillas-sap" class="hover:text-forest-900 transition">Planillas SAP</a>
        <span>›</span>
        <span class="text-forest-900">{{ planilla()?.numero_factura ?? 'Cargando...' }}</span>
      </div>

      @if (loading()) {
        <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
          Cargando planilla...
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ error() }}</div>
      } @else if (planilla()) {

        <!-- Cabecera -->
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-bold text-forest-900">Pre Factura {{ planilla()!.numero_factura }}</h1>
                <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      [class]="estadoChip(planilla()!.estado)">
                  {{ estadoLabel(planilla()!.estado) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-forest-600">{{ planilla()!.empresa_nombre }}</p>
              <p class="mt-1 text-xs text-forest-500">{{ planilla()!.glosa_cabecera }}</p>
            </div>
            <div class="rounded-2xl border border-forest-100 bg-forest-50 px-5 py-3 text-right">
              <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Monto Total</p>
              <p class="text-2xl font-bold text-teal-700">{{ formatCLP(planilla()!.monto_total) }}</p>
              <p class="text-xs text-forest-500">
                {{ planilla()!.total_documentos }} doc(s) · {{ planilla()!.total_lineas }} líneas
              </p>
            </div>
          </div>

          <!-- Metadata -->
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Fecha documento</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatDate(planilla()!.fecha_documento) }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Fecha contabilización</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatDate(planilla()!.fecha_contabilizacion) }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Temporada</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ planilla()!.temporada || '-' }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Cargo/Abono</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ planilla()!.codigo_cargo_abono || '-' }}</p>
            </div>
          </div>

          <!-- Acciones -->
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Descargar planilla SAP como archivo de texto"
                    (click)="descargar()"
                    class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
              Descargar Excel
            </button>
            @if (planilla()!.estado === 'generada') {
              <button type="button" (click)="marcarDescargada()"
                      class="rounded-xl border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Marcar como descargada
              </button>
            }
            @if (planilla()!.estado === 'descargada') {
              <button type="button" (click)="marcarContabilizada()"
                      class="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                Marcar como contabilizada
              </button>
            }
          </div>
          @if (actionError()) {
            <div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {{ actionError() }}
            </div>
          }
        </div>

        <!-- Documentos -->
        @for (doc of planilla()!.documentos; track doc.id_planilla_sap_documento) {
          <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-forest-900">
                  Documento #{{ doc.numero_documento }}
                </h2>
                <p class="text-xs text-forest-500">
                  CC: {{ doc.centro_costo_codigo || '-' }} · Cta Mayor: {{ doc.cuenta_mayor_codigo || '-' }}
                </p>
              </div>
              <span class="rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
                {{ doc.total_lineas }} líneas · {{ formatCLP(doc.monto_debito) }}
              </span>
            </div>

            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-3 py-2">#</th>
                    <th class="px-3 py-2">Tipo</th>
                    <th class="px-3 py-2">Cta / Proveedor</th>
                    <th class="px-3 py-2">Centro Costo</th>
                    <th class="px-3 py-2">OC</th>
                    <th class="px-3 py-2">Asignación</th>
                    <th class="px-3 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (linea of doc.lineas; track linea.id_planilla_sap_linea) {
                    <tr [class.bg-forest-50]="linea.es_doc_nuevo" [class.font-semibold]="linea.es_doc_nuevo">
                      <td class="px-3 py-2 text-forest-500">{{ linea.numero_linea }}</td>
                      <td class="px-3 py-2">
                        @if (linea.clave_contabilizacion === '50') {
                          <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DÉBITO</span>
                        } @else {
                          <span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">CRÉDITO</span>
                        }
                      </td>
                      <td class="px-3 py-2 text-forest-800">
                        {{ linea.cuenta_mayor || linea.codigo_proveedor || '-' }}
                      </td>
                      <td class="px-3 py-2 text-forest-600">{{ linea.centro_costo || '' }}</td>
                      <td class="px-3 py-2 text-forest-600">
                        @if (linea.orden_compra) {
                          {{ linea.orden_compra }}/{{ linea.posicion_oc }}
                        }
                      </td>
                      <td class="px-3 py-2 text-forest-600">{{ linea.nro_asignacion || '' }}</td>
                      <td class="px-3 py-2 text-right" [class.text-red-700]="linea.importe < 0"
                          [class.text-forest-900]="linea.importe >= 0">
                        {{ formatCLP(linea.importe) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </app-workspace-shell>
  `
})
export class PlanillaDetalleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading     = signal(false);
  readonly error       = signal('');
  readonly actionError = signal('');
  readonly planilla    = signal<PlanillaSapDetalle | null>(null);

  private idPlanilla = 0;

  constructor(
    private cflApi: CflApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.idPlanilla = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.idPlanilla) { this.router.navigate(['/planillas-sap']); return; }
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set('');
    this.cflApi.getPlanillaSapDetalle(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.planilla.set(res.data); this.loading.set(false); },
        error: (err) => { this.error.set(err?.error?.error ?? 'No se pudo cargar la planilla.'); this.loading.set(false); },
      });
  }

  descargar(): void {
    this.cflApi.exportarPlanillaSap(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => triggerDownload(blob, `planilla-sap-${this.planilla()?.numero_factura || this.idPlanilla}.xlsx`),
        error: () => this.actionError.set('Error al descargar el archivo.'),
      });
  }

  marcarDescargada(): void {
    this.cambiarEstado('descargada');
  }

  marcarContabilizada(): void {
    this.cambiarEstado('contabilizada');
  }

  private cambiarEstado(estado: string): void {
    this.actionError.set('');
    this.cflApi.cambiarEstadoPlanilla(this.idPlanilla, estado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadData(),
        error: (err) => this.actionError.set(err?.error?.error ?? 'Error al cambiar estado.'),
      });
  }

  estadoLabel(estado: string): string { return ESTADO_LABELS[estado] ?? estado; }
  estadoChip(estado: string): string { return ESTADO_CHIP[estado] ?? 'bg-slate-100 text-slate-700'; }
  readonly formatCLP  = formatCLP;
  readonly formatDate = formatDate;
}
