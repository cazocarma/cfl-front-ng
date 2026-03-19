
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FacturaDetalle } from '../../core/models/factura.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { estadoChipClass, estadoLabel } from '../../core/utils/factura.utils';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

@Component({
    selector: 'app-factura-detalle',
    imports: [RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell [title]="factura() ? 'Pre Factura ' + factura()!.numero_factura : 'Detalle de Pre Factura'"
                         subtitle="Cabecera, folios y movimientos de la pre factura."
                         activeSection="facturas">

      <!-- Breadcrumb -->
      <div class="mb-4 flex items-center gap-2 text-sm text-forest-500">
        <a routerLink="/facturas" class="hover:text-forest-900 transition">Pre Facturas</a>
        <span>›</span>
        <span class="text-forest-900">{{ factura()?.numero_factura ?? 'Cargando...' }}</span>
      </div>

      @if (loading()) {
        <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
          Cargando pre factura...
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ error() }}</div>
      } @else if (factura()) {

        <!-- Cabecera -->
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-bold text-forest-900">{{ factura()!.numero_factura }}</h1>
                <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      [class]="estadoChipClass(factura()!.estado)">
                  {{ estadoLabel(factura()!.estado) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-forest-600">{{ factura()!.empresa_nombre }}</p>
              @if (factura()!.empresa_rut) {
                <p class="text-xs text-forest-500">RUT: {{ factura()!.empresa_rut }}</p>
              }
            </div>

            <div class="rounded-2xl border border-forest-100 bg-forest-50 px-5 py-3 text-right">
              <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Total</p>
              <p class="text-2xl font-bold text-teal-700">{{ formatCLP(factura()!.monto_total) }}</p>
              <p class="text-xs text-forest-500">
                Neto {{ formatCLP(factura()!.monto_neto) }} + IVA {{ formatCLP(factura()!.monto_iva) }}
              </p>
            </div>
          </div>

          <!-- Metadata -->
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Fecha emisión</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatDate(factura()!.fecha_emision) }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Agrupación</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">Centro de Costo</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Folios</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ factura()!.folios.length }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Moneda</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ factura()!.moneda }}</p>
            </div>
          </div>

          <!-- Observaciones (solo lectura) -->
          @if (factura()!.observaciones) {
            <div class="mt-4 rounded-xl border border-forest-100 bg-forest-50 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Observaciones</p>
              <p class="mt-1 text-sm text-forest-700">{{ factura()!.observaciones }}</p>
            </div>
          }

          <!-- Acciones -->
          <div class="mt-5 flex flex-wrap items-center gap-3">
            @if (factura()!.estado === 'borrador') {
              <button type="button"
                      (click)="confirmarEmitir()"
                      class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
                Emitir pre factura
              </button>
            }
            @if (factura()!.estado !== 'anulada') {
              <button type="button"
                      (click)="descargarExcel()"
                      class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">
                Descargar Excel
              </button>
              <button type="button"
                      (click)="descargarPdf()"
                      class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">
                Descargar PDF
              </button>
            }
            @if (factura()!.estado === 'borrador') {
              <button type="button"
                      (click)="confirmarAnular()"
                      class="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                Anular
              </button>
            }
          </div>
        </div>

        <!-- Folios asociados -->
        <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-semibold text-forest-900">Folios asociados</h2>
          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  <th class="px-3 py-3">Folio</th>
                  <th class="px-3 py-3">Centro de Costo</th>
                  <th class="px-3 py-3 text-center">Movimientos</th>
                  <th class="px-3 py-3 text-right">Monto</th>
                  <th class="px-3 py-3">Período</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (folio of factura()!.folios; track folio.id_factura_folio) {
                  <tr>
                    <td class="px-3 py-3 font-semibold text-forest-900">{{ folio.folio_numero }}</td>
                    <td class="px-3 py-3 text-forest-600">
                      {{ folio.centro_costo_codigo ? folio.centro_costo_codigo + ' · ' : '' }}{{ folio.centro_costo || '-' }}
                    </td>
                    <td class="px-3 py-3 text-center text-forest-800">{{ folio.total_movimientos }}</td>
                    <td class="px-3 py-3 text-right font-semibold text-forest-900">{{ formatCLP(folio.monto_total_movimientos) }}</td>
                    <td class="px-3 py-3 text-xs text-forest-500">
                      {{ formatDate(folio.periodo_desde) }} – {{ formatDate(folio.periodo_hasta) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-3 py-5 text-center text-sm text-forest-500">Sin folios asociados.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Movimientos -->
        <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-forest-900">Movimientos</h2>
            <span class="rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
              {{ factura()!.movimientos.length }} registros
            </span>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  <th class="px-3 py-3">N° Guía / Entrega</th>
                  <th class="px-3 py-3">Folio</th>
                  <th class="px-3 py-3">Tipo Flete</th>
                  <th class="px-3 py-3">Centro Costo</th>
                  <th class="px-3 py-3">Ruta</th>
                  <th class="px-3 py-3">Fecha</th>
                  <th class="px-3 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (m of factura()!.movimientos; track m.id_cabecera_flete) {
                  <tr>
                    <td class="px-3 py-3 font-medium text-forest-900">
                      {{ m.guia_remision || m.numero_entrega || m.sap_numero_entrega || '-' }}
                    </td>
                    <td class="px-3 py-3 text-forest-600">{{ m.folio_numero }}</td>
                    <td class="px-3 py-3 text-forest-600">{{ m.tipo_flete_nombre || '-' }}</td>
                    <td class="px-3 py-3 text-forest-600">{{ m.centro_costo || '-' }}</td>
                    <td class="px-3 py-3 text-forest-600">{{ m.ruta || '-' }}</td>
                    <td class="px-3 py-3 text-forest-600">{{ formatDate(m.fecha_salida) }}</td>
                    <td class="px-3 py-3 text-right font-semibold text-forest-900">{{ formatCLP(m.monto_aplicado) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="px-3 py-5 text-center text-sm text-forest-500">Sin movimientos.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      }

      <!-- Modal: Confirmar emitir -->
      @if (showConfirmEmitir()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Emitir pre factura</h3>
            <p class="mt-2 text-sm text-forest-600">
              Una vez emitida, la pre factura quedará en estado <strong>Emitida</strong> y no podrá modificarse.
              ¿Confirmas?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmEmitir.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="emitirFactura()" [disabled]="cambiandoEstado()"
                      class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
                {{ cambiandoEstado() ? 'Emitiendo...' : 'Emitir' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Confirmar anular -->
      @if (showConfirmAnular()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Anular pre factura</h3>
            <p class="mt-2 text-sm text-forest-600">
              Se anulará la pre factura <strong>{{ factura()?.numero_factura }}</strong>.
              Los movimientos incluidos volverán al estado <em>Asignado Folio</em>.
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmAnular.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="anularFactura()" [disabled]="cambiandoEstado()"
                      class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {{ cambiandoEstado() ? 'Anulando...' : 'Anular' }}
              </button>
            </div>
          </div>
        </div>
      }

    </app-workspace-shell>
  `
})
export class FacturaDetalleComponent implements OnInit {
  readonly loading           = signal(false);
  readonly error             = signal('');
  readonly factura           = signal<FacturaDetalle | null>(null);
  readonly cambiandoEstado   = signal(false);
  readonly showConfirmEmitir = signal(false);
  readonly showConfirmAnular = signal(false);

  private idFactura = 0;

  constructor(
    private cflApi: CflApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.idFactura = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.idFactura) { this.router.navigate(['/facturas']); return; }
    this.loadFacturaData();
  }

  private loadFacturaData(): void {
    this.loading.set(true);
    this.error.set('');
    this.cflApi.getFacturaDetalle(this.idFactura).subscribe({
      next: (res) => { this.factura.set(res.data); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.error ?? 'No se pudo cargar la pre factura.'); this.loading.set(false); },
    });
  }

  confirmarEmitir(): void { this.showConfirmEmitir.set(true); }
  confirmarAnular(): void { this.showConfirmAnular.set(true); }

  emitirFactura(): void {
    this.cambiandoEstado.set(true);
    this.cflApi.cambiarEstadoFactura(this.idFactura, 'emitida').subscribe({
      next: () => { this.cambiandoEstado.set(false); this.showConfirmEmitir.set(false); this.loadFacturaData(); },
      error: (err) => { alert(err?.error?.error ?? 'Error al emitir.'); this.cambiandoEstado.set(false); },
    });
  }

  anularFactura(): void {
    this.cambiandoEstado.set(true);
    this.cflApi.cambiarEstadoFactura(this.idFactura, 'anulada').subscribe({
      next: () => { this.cambiandoEstado.set(false); this.showConfirmAnular.set(false); this.loadFacturaData(); },
      error: (err) => { alert(err?.error?.error ?? 'Error al anular.'); this.cambiandoEstado.set(false); },
    });
  }

  descargarExcel(): void {
    this.cflApi.exportarFacturaExcel(this.idFactura).subscribe({
      next: (blob) => triggerDownload(blob, `pre-factura-${this.factura()?.numero_factura}.xlsx`),
      error: () => alert('Error al descargar Excel.'),
    });
  }

  descargarPdf(): void {
    this.cflApi.exportarFacturaPdf(this.idFactura).subscribe({
      next: (blob) => triggerDownload(blob, `pre-factura-${this.factura()?.numero_factura}.pdf`),
      error: () => alert('Error al descargar PDF.'),
    });
  }

  readonly estadoLabel     = estadoLabel;
  readonly estadoChipClass = estadoChipClass;
  readonly formatCLP       = formatCLP;
  readonly formatDate      = formatDate;
}
