
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EstadoFactura, FacturaListItem } from '../../core/models/factura.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { estadoChipClass, estadoLabel } from '../../core/utils/factura.utils';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

@Component({
    selector: 'app-facturas',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell title="Pre Facturas" subtitle="Listado y gestión de pre facturas internas de transporte." activeSection="facturas">

      <!-- Filtros -->
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Empresa</label>
          <input
            type="text"
            [ngModel]="filtroEmpresa()"
            (ngModelChange)="filtroEmpresa.set($event)"
            placeholder="Buscar empresa..."
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Estado</label>
          <select
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          >
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="recibida">Recibida</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Desde</label>
          <input
            type="date"
            [ngModel]="filtroDesde()"
            (ngModelChange)="filtroDesde.set($event)"
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Hasta</label>
          <input
            type="date"
            [ngModel]="filtroHasta()"
            (ngModelChange)="filtroHasta.set($event)"
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <button
          type="button"
          (click)="cargarFacturas()"
          class="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 active:bg-forest-800"
        >
          Filtrar
        </button>

        <button
          type="button"
          (click)="limpiarFiltros()"
          class="rounded-xl border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 shadow-sm transition hover:bg-forest-50"
        >
          Limpiar
        </button>

        <div class="ml-auto">
          <a
            routerLink="/facturas/nueva"
            class="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            + Nueva Pre Factura
          </a>
        </div>
      </div>

      <!-- Tabla -->
      <div class="rounded-2xl border border-forest-100 bg-white shadow-sm">
        @if (loading()) {
          <div class="px-6 py-10 text-center text-sm text-forest-500">Cargando pre facturas...</div>
        } @else if (error()) {
          <div class="px-6 py-6 text-sm text-red-700">{{ error() }}</div>
        } @else if (facturasFiltradas().length === 0) {
          <div class="px-6 py-10 text-center text-sm text-forest-500">
            No hay pre facturas que coincidan con los filtros aplicados.
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  <th class="px-4 py-3">N° Pre Factura</th>
                  <th class="px-4 py-3">Empresa</th>
                  <th class="px-4 py-3">Centro de Costo</th>
                  <th class="px-4 py-3 text-center">Movimientos</th>
                  <th class="px-4 py-3 text-right">Monto Total</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">N° Factura Recibida</th>
                  <th class="px-4 py-3">Fecha Emisión</th>
                  <th class="px-4 py-3 sticky right-0 bg-white">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (fac of facturasFiltradas(); track fac.id_factura) {
                  <tr class="hover:bg-forest-50 transition">
                    <td class="px-4 py-3 font-semibold text-forest-900">{{ fac.numero_factura }}</td>
                    <td class="px-4 py-3 text-forest-700">{{ fac.empresa_nombre }}</td>
                    <td class="px-4 py-3 text-forest-600 text-xs">{{ fac.centro_costos || '—' }}</td>
                    <td class="px-4 py-3 text-center font-medium text-forest-800">{{ fac.cantidad_movimientos }}</td>
                    <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCLP(fac.monto_total) }}</td>
                    <td class="px-4 py-3">
                      <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            [class]="estadoChipClass(fac.estado)">
                        {{ estadoLabel(fac.estado) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-forest-600">{{ fac.numero_factura_recibida || '—' }}</td>
                    <td class="px-4 py-3 text-forest-600">{{ formatDate(fac.fecha_emision) }}</td>
                    <td class="px-4 py-3 sticky right-0 bg-white">
                      <div class="flex items-center gap-1">
                        <!-- Ver / Editar -->
                        <a [routerLink]="['/facturas', fac.id_factura]"
                           [title]="fac.estado === 'borrador' ? 'Editar' : 'Ver'"
                           class="inline-flex items-center justify-center rounded-lg p-1.5 text-forest-500 transition hover:bg-forest-100 hover:text-forest-800">
                          @if (fac.estado === 'borrador') {
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          } @else {
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                          }
                        </a>
                        @if (fac.estado !== 'anulada') {
                          <!-- Excel -->
                          <button type="button" title="Descargar Excel" aria-label="Descargar pre factura en Excel"
                                  (click)="descargarExcel(fac)"
                                  class="inline-flex items-center justify-center rounded-lg p-1.5 text-teal-600 transition hover:bg-teal-50 hover:text-teal-800">
                            <svg aria-hidden="true" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 10h18M3 6h18M3 14h18M3 18h18"/>
                            </svg>
                          </button>
                          <!-- PDF -->
                          <button type="button" title="Descargar PDF" aria-label="Descargar pre factura en PDF"
                                  (click)="descargarPdf(fac)"
                                  class="inline-flex items-center justify-center rounded-lg p-1.5 text-teal-600 transition hover:bg-teal-50 hover:text-teal-800">
                            <svg aria-hidden="true" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                          </button>
                        }
                        @if (fac.estado === 'borrador') {
                          <!-- Anular -->
                          <button type="button" title="Anular pre factura" aria-label="Anular pre factura"
                                  (click)="confirmarAnular(fac)"
                                  class="inline-flex items-center justify-center rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700">
                            <svg aria-hidden="true" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                            </svg>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="border-t border-forest-100 px-4 py-2 text-xs text-forest-500">
            {{ facturasFiltradas().length }} pre factura(s)
          </div>
        }
      </div>

      @if (actionError()) {
        <div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {{ actionError() }}
        </div>
      }

      <!-- Modal de confirmación de anulación -->
      @if (facturaAAnular()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Anular pre factura</h3>
            <p class="mt-2 text-sm text-forest-600">
              ¿Estás seguro de que deseas anular la pre factura
              <strong>{{ facturaAAnular()?.numero_factura }}</strong>?
              Los movimientos asociados volverán a estar disponibles.
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button"
                      (click)="facturaAAnular.set(null)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button"
                      (click)="anularFactura()"
                      [disabled]="anulando()"
                      class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {{ anulando() ? 'Anulando...' : 'Anular pre factura' }}
              </button>
            </div>
          </div>
        </div>
      }

    </app-workspace-shell>
  `
})
export class FacturasComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading        = signal(false);
  readonly error          = signal('');
  readonly actionError    = signal('');
  readonly facturas       = signal<FacturaListItem[]>([]);
  readonly facturaAAnular = signal<FacturaListItem | null>(null);
  readonly anulando       = signal(false);

  readonly filtroEmpresa = signal('');
  readonly filtroEstado  = signal<EstadoFactura | ''>('');
  readonly filtroDesde   = signal('');
  readonly filtroHasta   = signal('');

  readonly facturasFiltradas = computed(() => {
    const q = this.filtroEmpresa().toLowerCase().trim();
    const estado = this.filtroEstado();
    return this.facturas().filter(f => {
      if (q && !f.empresa_nombre.toLowerCase().includes(q)) return false;
      if (estado && f.estado !== estado) return false;
      return true;
    });
  });

  constructor(private cflApi: CflApiService, private router: Router) {}

  ngOnInit(): void {
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');

    const params: Record<string, unknown> = {};
    if (this.filtroEstado()) params['estado'] = this.filtroEstado();
    if (this.filtroDesde())  params['desde']  = this.filtroDesde();
    if (this.filtroHasta())  params['hasta']  = this.filtroHasta();

    this.cflApi.getFacturasLista(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.facturas.set(res.data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'No se pudieron cargar las pre facturas.');
          this.loading.set(false);
        },
      });
  }

  limpiarFiltros(): void {
    this.filtroEmpresa.set('');
    this.filtroEstado.set('');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.cargarFacturas();
  }

  confirmarAnular(fac: FacturaListItem): void {
    this.facturaAAnular.set(fac);
  }

  anularFactura(): void {
    const fac = this.facturaAAnular();
    if (!fac) return;
    this.anulando.set(true);
    this.actionError.set('');
    this.cflApi.cambiarEstadoFactura(fac.id_factura, 'anulada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.anulando.set(false);
          this.facturaAAnular.set(null);
          this.cargarFacturas();
        },
        error: (err) => {
          this.actionError.set(err?.error?.error ?? 'Error al anular la pre factura.');
          this.anulando.set(false);
        },
      });
  }

  descargarExcel(fac: FacturaListItem): void {
    this.cflApi.exportarFacturaExcel(fac.id_factura)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => triggerDownload(blob, `pre-factura-${fac.numero_factura}.xlsx`),
        error: () => this.actionError.set('Error al descargar Excel.'),
      });
  }

  descargarPdf(fac: FacturaListItem): void {
    this.cflApi.exportarFacturaPdf(fac.id_factura)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => triggerDownload(blob, `pre-factura-${fac.numero_factura}.pdf`),
        error: () => this.actionError.set('Error al descargar PDF.'),
      });
  }

  readonly estadoLabel    = estadoLabel;
  readonly estadoChipClass = estadoChipClass;
  readonly formatCLP      = formatCLP;
  readonly formatDate     = formatDate;
}
