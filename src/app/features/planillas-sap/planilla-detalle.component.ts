import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DisabledIfNoPermissionDirective } from '../../core/directives/disabled-if-no-permission.directive';
import { PlanillaSapDetalle, PlanillaSapFacturaVinculada } from '../../core/models/planilla-sap.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

const ESTADO_LABELS: Record<string, string> = {
  generada: 'Generada',
  enviada: 'Enviada',
  anulada: 'Anulada',
};

const ESTADO_CHIP: Record<string, string> = {
  generada: 'bg-slate-100 text-slate-700',
  enviada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
};

interface FacturaElegible {
  id_factura: number;
  numero_factura: string;
  fecha_emision: string;
  empresa_nombre: string;
  monto_total: number;
}

@Component({
  selector: 'app-planilla-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, WorkspaceShellComponent, DisabledIfNoPermissionDirective],
  template: `
    <app-workspace-shell
      [title]="planilla() ? 'Planilla SAP — ' + planilla()!.periodo_label : 'Detalle Planilla SAP'"
      subtitle="Detalle de la planilla SAP generada con sus documentos y líneas."
      activeSection="planillas">

      <!-- Breadcrumb -->
      <div class="mb-4 flex items-center gap-2 text-sm text-forest-500">
        <a routerLink="/planillas-sap" class="inline-flex items-center justify-center rounded-lg p-1.5 text-forest-500 hover:bg-forest-100 hover:text-forest-900 transition" title="Volver a Planillas SAP">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <a routerLink="/planillas-sap" class="hover:text-forest-900 transition">Planillas SAP</a>
        <span>›</span>
        <span class="text-forest-900">{{ planilla()?.periodo_label ?? 'Cargando...' }}</span>
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
                <h1 class="text-xl font-bold text-forest-900">Planilla SAP</h1>
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
            <button type="button" aria-label="Descargar planilla SAP como Excel"
                    (click)="descargar()"
                    class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
              Descargar Excel
            </button>
            @if (planilla()!.estado === 'generada') {
              <button type="button" (click)="confirmarEnvio()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                Marcar como enviada
              </button>
              <button type="button" (click)="confirmarAnulacion()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                Anular planilla
              </button>
            }
          </div>
          @if (actionError()) {
            <div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {{ actionError() }}
            </div>
          }
        </div>

        <!-- Pre Facturas incluidas -->
        <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-sm font-semibold text-forest-900">Pre Facturas incluidas</h2>
            @if (planilla()!.estado === 'generada') {
              <button type="button" (click)="toggleAgregarPanel()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition">
                + Agregar pre facturas
              </button>
            }
          </div>

          <!-- Panel agregar pre facturas -->
          @if (showAgregarPanel()) {
            <div class="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-teal-700">Pre facturas disponibles (mismo período)</h3>
                <button type="button" (click)="showAgregarPanel.set(false)"
                        class="text-xs text-teal-500 hover:text-teal-800">Cerrar</button>
              </div>
              @if (loadingElegibles()) {
                <p class="text-sm text-teal-600">Cargando...</p>
              } @else if (facturasElegibles().length === 0) {
                <p class="text-sm text-teal-600">No hay pre facturas disponibles en el mismo período.</p>
              } @else {
                <div class="overflow-x-auto rounded-lg border border-teal-100">
                  <table class="min-w-full divide-y divide-teal-100 text-sm">
                    <thead>
                      <tr class="text-left text-xs uppercase tracking-wider text-teal-600 bg-teal-100/50">
                        <th class="px-3 py-2">Pre Factura</th>
                        <th class="px-3 py-2">Empresa</th>
                        <th class="px-3 py-2">Emisión</th>
                        <th class="px-3 py-2 text-right">Monto</th>
                        <th class="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-teal-50">
                      @for (fac of facturasElegibles(); track fac.id_factura) {
                        <tr class="hover:bg-teal-50/50">
                          <td class="px-3 py-2 font-medium text-forest-900">{{ fac.numero_factura }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ fac.empresa_nombre }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ formatDate(fac.fecha_emision) }}</td>
                          <td class="px-3 py-2 text-right font-semibold text-forest-900">{{ formatCLP(fac.monto_total) }}</td>
                          <td class="px-3 py-2">
                            <button type="button" (click)="agregarFactura(fac.id_factura)" [disabled]="actionBusy()"
                                    [disabledIfNoPermission]="'planillas.generar'"
                                    class="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                              Agregar
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- Tabla de facturas vinculadas -->
          <div class="overflow-x-auto rounded-xl border border-forest-100">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500 bg-forest-50">
                  <th class="px-4 py-3">Pre Factura</th>
                  <th class="px-4 py-3">Empresa</th>
                  @if (planilla()!.estado === 'generada') {
                    <th class="px-4 py-3"></th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (fac of planilla()!.facturas; track fac.id_factura) {
                  <tr>
                    <td class="px-4 py-3 font-medium text-forest-900">{{ fac.numero_factura }}</td>
                    <td class="px-4 py-3 text-forest-600">{{ fac.empresa_nombre }}</td>
                    @if (planilla()!.estado === 'generada') {
                      <td class="px-4 py-3">
                        <button type="button" (click)="quitarFactura(fac)" [disabled]="actionBusy()"
                                [disabledIfNoPermission]="'planillas.generar'"
                                class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50">
                          Quitar
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="planilla()!.estado === 'generada' ? 3 : 2"
                        class="px-4 py-5 text-center text-sm text-forest-500">
                      Sin pre facturas vinculadas.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
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
                    @if (linea.importe !== 0) {
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
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <!-- Modal confirmación envío -->
      @if (showConfirmEnvio()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Marcar como enviada</h3>
            <p class="mt-2 text-sm text-forest-600">
              Una vez enviada, la planilla no podrá ser modificada. ¿Continuar?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmEnvio.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="marcarEnviada()" [disabled]="actionBusy()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {{ actionBusy() ? 'Procesando...' : 'Confirmar envío' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal confirmación anulación -->
      @if (showConfirmAnular()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-red-800">Anular planilla</h3>
            <p class="mt-2 text-sm text-forest-600">
              Las pre facturas incluidas quedarán disponibles para generar otra planilla. ¿Continuar?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmAnular.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="anularPlanilla()" [disabled]="actionBusy()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {{ actionBusy() ? 'Anulando...' : 'Anular planilla' }}
              </button>
            </div>
          </div>
        </div>
      }

    </app-workspace-shell>
  `
})
export class PlanillaDetalleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading     = signal(false);
  readonly error       = signal('');
  readonly actionError = signal('');
  readonly actionBusy  = signal(false);
  readonly planilla    = signal<PlanillaSapDetalle | null>(null);

  // Agregar pre facturas
  readonly showAgregarPanel  = signal(false);
  readonly loadingElegibles  = signal(false);
  readonly facturasElegibles = signal<FacturaElegible[]>([]);

  // Modals
  readonly showConfirmEnvio  = signal(false);
  readonly showConfirmAnular = signal(false);

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
        next: (blob) => {
          const label = (this.planilla()?.periodo_label || String(this.idPlanilla)).replace(/\s+/g, '-');
          triggerDownload(blob, `planilla-sap-${label}.xlsx`);
        },
        error: () => this.actionError.set('Error al descargar el archivo.'),
      });
  }

  // --- Agregar pre facturas ---

  toggleAgregarPanel(): void {
    const open = !this.showAgregarPanel();
    this.showAgregarPanel.set(open);
    if (open) this.loadElegibles();
  }

  private loadElegibles(): void {
    this.loadingElegibles.set(true);
    this.cflApi.getPlanillaFacturasElegibles(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.facturasElegibles.set((res.data || []) as unknown as FacturaElegible[]);
          this.loadingElegibles.set(false);
        },
        error: () => {
          this.facturasElegibles.set([]);
          this.loadingElegibles.set(false);
        },
      });
  }

  agregarFactura(idFactura: number): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.agregarFacturasPlanilla(this.idPlanilla, [idFactura])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.loadData();
          this.loadElegibles();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al agregar pre factura.');
        },
      });
  }

  // --- Quitar pre factura ---

  quitarFactura(fac: PlanillaSapFacturaVinculada): void {
    if (!confirm(`¿Quitar la pre factura ${fac.numero_factura} de esta planilla?`)) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.quitarFacturaPlanilla(this.idPlanilla, fac.id_factura)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.loadData();
          if (this.showAgregarPanel()) this.loadElegibles();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al quitar pre factura.');
        },
      });
  }

  // --- Enviar ---

  confirmarEnvio(): void { this.showConfirmEnvio.set(true); }

  marcarEnviada(): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.cambiarEstadoPlanilla(this.idPlanilla, 'enviada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.showConfirmEnvio.set(false);
          this.loadData();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al marcar como enviada.');
        },
      });
  }

  // --- Anular ---

  confirmarAnulacion(): void { this.showConfirmAnular.set(true); }

  anularPlanilla(): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.cambiarEstadoPlanilla(this.idPlanilla, 'anulada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.showConfirmAnular.set(false);
          this.loadData();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al anular la planilla.');
        },
      });
  }

  estadoLabel(estado: string): string { return ESTADO_LABELS[estado] ?? estado; }
  estadoChip(estado: string): string { return ESTADO_CHIP[estado] ?? 'bg-slate-100 text-slate-700'; }
  readonly formatCLP  = formatCLP;
  readonly formatDate = formatDate;
}
