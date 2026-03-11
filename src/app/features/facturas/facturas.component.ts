
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { FacturaListItem, EstadoFactura } from '../../core/models/factura.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

@Component({
    selector: 'app-facturas',
    imports: [FormsModule, RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell title="Facturas" subtitle="Listado y gestión de facturas internas de transporte." activeSection="facturas">

      <!-- Filtros -->
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Empresa</label>
          <input
            type="text"
            [(ngModel)]="filtroEmpresa"
            placeholder="Buscar empresa..."
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Estado</label>
          <select
            [(ngModel)]="filtroEstado"
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          >
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="emitida">Emitida</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Desde</label>
          <input
            type="date"
            [(ngModel)]="filtroDesde"
            class="rounded-xl border border-forest-200 bg-white px-3 py-2 text-sm text-forest-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Hasta</label>
          <input
            type="date"
            [(ngModel)]="filtroHasta"
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
            + Nueva Factura
          </a>
        </div>
      </div>

      <!-- Tabla -->
      <div class="rounded-2xl border border-forest-100 bg-white shadow-sm">
        @if (loading()) {
          <div class="px-6 py-10 text-center text-sm text-forest-500">Cargando facturas...</div>
        } @else if (error()) {
          <div class="px-6 py-6 text-sm text-red-700">{{ error() }}</div>
        } @else if (facturasFiltradas().length === 0) {
          <div class="px-6 py-10 text-center text-sm text-forest-500">
            No hay facturas que coincidan con los filtros aplicados.
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                  <th class="px-4 py-3">N° Factura</th>
                  <th class="px-4 py-3">Empresa</th>
                  <th class="px-4 py-3">Criterio</th>
                  <th class="px-4 py-3 text-center">Folios</th>
                  <th class="px-4 py-3 text-right">Monto Total</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3 sticky right-0 bg-white">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (fac of facturasFiltradas(); track fac.id_factura) {
                  <tr class="hover:bg-forest-50 transition">
                    <td class="px-4 py-3 font-semibold text-forest-900">{{ fac.numero_factura }}</td>
                    <td class="px-4 py-3 text-forest-700">{{ fac.empresa_nombre }}</td>
                    <td class="px-4 py-3 text-forest-600">
                      {{ criterioLabel(fac.criterio_agrupacion) }}
                    </td>
                    <td class="px-4 py-3 text-center font-medium text-forest-800">{{ fac.cantidad_folios }}</td>
                    <td class="px-4 py-3 text-right font-semibold text-forest-900">{{ formatCLP(fac.monto_total) }}</td>
                    <td class="px-4 py-3">
                      <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            [class]="estadoChipClass(fac.estado)">
                        {{ estadoLabel(fac.estado) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-forest-600">{{ formatDate(fac.fecha_emision) }}</td>
                    <td class="px-4 py-3 sticky right-0 bg-white">
                      <div class="flex items-center gap-2">
                        <a [routerLink]="['/facturas', fac.id_factura]"
                           class="text-xs font-semibold text-forest-600 hover:text-forest-900 transition">
                          {{ fac.estado === 'borrador' ? 'Editar' : 'Ver' }}
                        </a>
                        @if (fac.estado !== 'anulada') {
                          <button type="button"
                                  (click)="descargarExcel(fac)"
                                  class="text-xs font-semibold text-teal-600 hover:text-teal-900 transition">
                            Excel
                          </button>
                          <button type="button"
                                  (click)="descargarPdf(fac)"
                                  class="text-xs font-semibold text-teal-600 hover:text-teal-900 transition">
                            PDF
                          </button>
                        }
                        @if (fac.estado === 'borrador') {
                          <button type="button"
                                  (click)="confirmarAnular(fac)"
                                  class="text-xs font-semibold text-red-600 hover:text-red-800 transition">
                            Anular
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
            {{ facturasFiltradas().length }} factura(s)
          </div>
        }
      </div>

      <!-- Modal de confirmación de anulación -->
      @if (facturaAAnular()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Anular factura</h3>
            <p class="mt-2 text-sm text-forest-600">
              ¿Estás seguro de que deseas anular la factura
              <strong>{{ facturaAAnular()?.numero_factura }}</strong>?
              Los movimientos asociados volverán al estado <em>Asignado Folio</em>.
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
                {{ anulando() ? 'Anulando...' : 'Anular factura' }}
              </button>
            </div>
          </div>
        </div>
      }

    </app-workspace-shell>
  `
})
export class FacturasComponent implements OnInit {
  readonly loading = signal(false);
  readonly error   = signal('');
  readonly facturas = signal<FacturaListItem[]>([]);
  readonly facturaAAnular = signal<FacturaListItem | null>(null);
  readonly anulando = signal(false);

  filtroEmpresa = '';
  filtroEstado  = '';
  filtroDesde   = '';
  filtroHasta   = '';

  readonly facturasFiltradas = computed(() => {
    const q = this.filtroEmpresa.toLowerCase().trim();
    return this.facturas().filter(f => {
      if (q && !f.empresa_nombre.toLowerCase().includes(q)) return false;
      if (this.filtroEstado && f.estado !== this.filtroEstado) return false;
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

    const params: Record<string, unknown> = {};
    if (this.filtroEstado) params['estado']  = this.filtroEstado;
    if (this.filtroDesde)  params['desde']   = this.filtroDesde;
    if (this.filtroHasta)  params['hasta']   = this.filtroHasta;

    this.cflApi.getFacturasLista(params).subscribe({
      next: (res) => {
        this.facturas.set(res.data as FacturaListItem[]);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudieron cargar las facturas.');
        this.loading.set(false);
      },
    });
  }

  limpiarFiltros(): void {
    this.filtroEmpresa = '';
    this.filtroEstado  = '';
    this.filtroDesde   = '';
    this.filtroHasta   = '';
    this.cargarFacturas();
  }

  confirmarAnular(fac: FacturaListItem): void {
    this.facturaAAnular.set(fac);
  }

  anularFactura(): void {
    const fac = this.facturaAAnular();
    if (!fac) return;
    this.anulando.set(true);
    this.cflApi.cambiarEstadoFactura(fac.id_factura, 'anulada').subscribe({
      next: () => {
        this.anulando.set(false);
        this.facturaAAnular.set(null);
        this.cargarFacturas();
      },
      error: (err) => {
        alert(err?.error?.error ?? 'Error al anular la factura.');
        this.anulando.set(false);
      },
    });
  }

  descargarExcel(fac: FacturaListItem): void {
    this.cflApi.exportarFacturaExcel(fac.id_factura).subscribe({
      next: (blob) => this._triggerDownload(blob, `factura-${fac.numero_factura}.xlsx`),
      error: () => alert('Error al descargar Excel.'),
    });
  }

  descargarPdf(fac: FacturaListItem): void {
    this.cflApi.exportarFacturaPdf(fac.id_factura).subscribe({
      next: (blob) => this._triggerDownload(blob, `factura-${fac.numero_factura}.pdf`),
      error: () => alert('Error al descargar PDF.'),
    });
  }

  private _triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  criterioLabel(criterio: string | null): string {
    if (criterio === 'centro_costo') return 'Centro de Costo';
    if (criterio === 'tipo_flete')   return 'Tipo de Flete';
    return '-';
  }

  estadoLabel(estado: EstadoFactura): string {
    const labels: Record<EstadoFactura, string> = {
      borrador: 'Borrador',
      emitida: 'Emitida',
      anulada: 'Anulada',
    };
    return labels[estado] ?? estado;
  }

  estadoChipClass(estado: EstadoFactura): string {
    if (estado === 'emitida')  return 'bg-emerald-100 text-emerald-700';
    if (estado === 'anulada')  return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  }

  formatCLP(v: unknown): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
      .format(Number(v) || 0);
  }

  formatDate(v: unknown): string {
    if (!v) return '-';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('es-CL').format(d);
  }
}
