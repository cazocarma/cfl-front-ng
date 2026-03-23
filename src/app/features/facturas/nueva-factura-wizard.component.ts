
import { Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EmpresaElegible, FolioElegible, GrupoPreview, PeriodoDisponible, PreviewResult } from '../../core/models/factura.model';
import { CRITERIO_DEFECTO, nombreMes } from '../../core/constants/factura.constants';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

type Step = 1 | 2 | 3 | 4;

@Component({
    selector: 'app-nueva-factura-wizard',
    imports: [FormsModule, RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell title="Nueva Pre Factura" subtitle="Generación de pre facturas de transporte por periodo y centro de costo." activeSection="facturas">

      <!-- Stepper -->
      <nav class="mb-8 flex items-center gap-0 overflow-x-auto">
        @for (s of steps; track s.n) {
          <div class="flex items-center">
            <button type="button"
                    (click)="irAStep(s.n)"
                    [disabled]="!puedeIrAStep(s.n)"
                    class="flex items-center gap-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-default"
                    [class.text-teal-700]="step() === s.n"
                    [class.text-forest-900]="step() > s.n"
                    [class.text-forest-400]="step() < s.n">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    [class.bg-teal-600]="step() === s.n"
                    [class.text-white]="step() === s.n"
                    [class.bg-forest-200]="step() !== s.n"
                    [class.text-forest-700]="step() !== s.n">
                {{ s.n }}
              </span>
              {{ s.label }}
            </button>
            @if (s.n < 4) {
              <span class="mx-1 text-forest-300">›</span>
            }
          </div>
        }
      </nav>

      <!-- PASO 1: Empresa + Periodo -->
      @if (step() === 1) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-forest-900">Paso 1 — Transportista y período</h2>
            <p class="mt-1 text-sm text-forest-500">Selecciona la empresa transportista e indica el período de los movimientos a pre facturar.</p>

            @if (loadingEmpresas()) {
              <p class="mt-6 text-sm text-forest-500">Cargando empresas...</p>
            } @else if (empresas().length === 0) {
              <div class="mt-6 rounded-xl border border-dashed border-forest-200 px-5 py-8 text-center text-sm text-forest-500">
                No hay empresas con folios elegibles en este momento.
              </div>
            } @else {
              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                @for (emp of empresas(); track emp.id_empresa) {
                  <button type="button"
                          (click)="seleccionarEmpresa(emp)"
                          class="flex flex-col gap-1 rounded-2xl border p-4 text-left transition"
                          [class.border-teal-500]="empresaSeleccionada()?.id_empresa === emp.id_empresa"
                          [class.bg-teal-50]="empresaSeleccionada()?.id_empresa === emp.id_empresa"
                          [class.border-forest-100]="empresaSeleccionada()?.id_empresa !== emp.id_empresa"
                          [class.hover:border-forest-300]="empresaSeleccionada()?.id_empresa !== emp.id_empresa">
                    <span class="font-semibold text-forest-900">{{ emp.empresa_nombre }}</span>
                    <span class="text-xs text-forest-500">RUT: {{ emp.rut }}</span>
                    <span class="mt-1 self-start rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
                      {{ emp.folios_disponibles }} folio(s) disponible(s)
                    </span>
                  </button>
                }
              </div>
            }
          </div>

          <!-- Período -->
          @if (empresaSeleccionada()) {
            <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
              <h3 class="text-sm font-semibold text-forest-900">Período de pre facturación</h3>
              <p class="mt-1 text-xs text-forest-500">
                Selecciona el mes con movimientos a incluir en la pre factura.
              </p>

              @if (loadingPeriodos()) {
                <p class="mt-5 text-sm text-forest-500">Cargando períodos...</p>
              } @else if (periodos().length === 0) {
                <div class="mt-5 rounded-xl border border-dashed border-forest-200 px-5 py-6 text-center text-sm text-forest-500">
                  No hay movimientos elegibles para esta empresa.
                </div>
              } @else {
                <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  @for (p of periodos(); track p.anio + '-' + p.mes) {
                    <button type="button"
                            (click)="seleccionarPeriodo(p)"
                            class="flex flex-col gap-1 rounded-2xl border p-4 text-left transition"
                            [class.border-teal-500]="periodoSeleccionado()?.anio === p.anio && periodoSeleccionado()?.mes === p.mes"
                            [class.bg-teal-50]="periodoSeleccionado()?.anio === p.anio && periodoSeleccionado()?.mes === p.mes"
                            [class.border-forest-100]="!(periodoSeleccionado()?.anio === p.anio && periodoSeleccionado()?.mes === p.mes)"
                            [class.hover:border-forest-300]="!(periodoSeleccionado()?.anio === p.anio && periodoSeleccionado()?.mes === p.mes)">
                      <span class="font-semibold text-forest-900 capitalize">{{ nombreMes(p.mes) }} {{ p.anio }}</span>
                      <span class="text-xs text-forest-500">{{ p.total_movimientos }} movimiento(s)</span>
                      <span class="mt-1 self-start rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
                        {{ formatCLP(p.monto_neto) }}
                      </span>
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- PASO 2: Resumen de folios -->
      @if (step() === 2) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-forest-900">Paso 2 — Resumen de folios a pre facturar</h2>
              <p class="mt-1 text-sm text-forest-500">
                Empresa: <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>
                @if (periodoDesde() || periodoHasta()) {
                  &nbsp;·&nbsp;Período:
                  <strong>{{ periodoDesde() ? formatFecha(periodoDesde()) : '…' }} – {{ periodoHasta() ? formatFecha(periodoHasta()) : '…' }}</strong>
                }
              </p>
            </div>
            @if (!loadingFolios() && folios().length > 0) {
              <div class="rounded-xl bg-forest-50 border border-forest-100 px-4 py-2 text-right text-sm">
                <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Total estimado</p>
                <p class="text-lg font-bold text-teal-700">{{ totalFolios() }}</p>
                <p class="text-xs text-forest-500">{{ folios().length }} folio(s) · {{ totalMovimientosFolios() }} movimiento(s)</p>
              </div>
            }
          </div>

          @if (loadingFolios()) {
            <p class="mt-6 text-sm text-forest-500">Cargando folios...</p>
          } @else if (folios().length === 0) {
            <div class="mt-6 rounded-xl border border-dashed border-forest-200 px-5 py-8 text-center text-sm text-forest-500">
              No se encontraron folios elegibles para el período indicado.
              <br><span class="text-xs">Ajusta las fechas o verifica que haya movimientos en estado "Asignado Folio".</span>
            </div>
          } @else {
            <div class="mt-5 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-3 py-3">Folio</th>
                    <th class="px-3 py-3">Centro de Costo</th>
                    <th class="px-3 py-3">Tipo Flete Principal</th>
                    <th class="px-3 py-3 text-center">Movimientos</th>
                    <th class="px-3 py-3 text-right">Monto Estimado</th>
                    <th class="px-3 py-3">Período Folio</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (folio of folios(); track folio.id_folio) {
                    <tr class="bg-teal-50/30">
                      <td class="px-3 py-3 font-semibold text-forest-900">{{ folio.folio_numero }}</td>
                      <td class="px-3 py-3 text-forest-600">
                        {{ folio.centro_costo_codigo ? folio.centro_costo_codigo + ' · ' : '' }}{{ folio.centro_costo || '-' }}
                      </td>
                      <td class="px-3 py-3 text-forest-600">{{ folio.primary_tipo_flete_nombre || '-' }}</td>
                      <td class="px-3 py-3 text-center font-medium text-forest-800">{{ folio.total_movimientos }}</td>
                      <td class="px-3 py-3 text-right font-semibold text-forest-900">{{ formatCLP(folio.monto_neto_estimado) }}</td>
                      <td class="px-3 py-3 text-forest-600 text-xs">
                        {{ formatFecha(folio.periodo_desde) }} – {{ formatFecha(folio.periodo_hasta) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-xs text-forest-500">
              Todos los folios listados serán incluidos automáticamente. Las pre facturas se agruparán por <strong>Centro de Costo</strong>.
            </p>
          }
        </div>
      }

      <!-- PASO 3: Vista previa -->
      @if (step() === 3) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-base font-semibold text-forest-900">Paso 3 — Vista previa de generación</h2>
            <p class="mt-1 text-sm text-forest-500">
              Se generarán <strong>{{ preview()?.cantidad_facturas ?? 0 }}</strong> pre factura(s) agrupadas por
              <strong>Centro de Costo</strong>.
            </p>
          </div>

          @if (loadingPreview()) {
            <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
              Calculando agrupación...
            </div>
          } @else if (errorPreview()) {
            <div class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">{{ errorPreview() }}</div>
          } @else {
            @for (grupo of preview()?.grupos ?? []; track grupo.grupo_clave) {
              <div class="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span class="rounded-full bg-teal-200 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                      {{ grupo.grupo_label }}
                    </span>
                    <p class="mt-2 text-sm font-semibold text-forest-900">
                      {{ grupo.cantidad_movimientos }} movimiento(s) · {{ grupo.ids_folio.length }} folio(s)
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-forest-500 uppercase tracking-widest">Monto total</p>
                    <p class="text-xl font-bold text-teal-700">{{ formatCLP(grupo.monto_total) }}</p>
                    <p class="text-xs text-forest-500">Neto {{ formatCLP(grupo.monto_neto) }} + IVA {{ formatCLP(grupo.monto_iva) }}</p>
                  </div>
                </div>

                <div class="mt-4 overflow-x-auto">
                  <table class="min-w-full divide-y divide-forest-200 text-xs">
                    <thead>
                      <tr class="text-left font-semibold uppercase tracking-[0.18em] text-forest-500">
                        <th class="px-2 py-2">Folio</th>
                        <th class="px-2 py-2">Entrega / Guía</th>
                        <th class="px-2 py-2">Tipo Flete</th>
                        <th class="px-2 py-2">Centro Costo</th>
                        <th class="px-2 py-2">Fecha</th>
                        <th class="px-2 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-200">
                      @for (m of grupo.movimientos; track m.id_cabecera_flete) {
                        <tr>
                          <td class="px-2 py-2">{{ m.folio_numero || '-' }}</td>
                          <td class="px-2 py-2">{{ m.numero_entrega || m.sap_numero_entrega || m.guia_remision || '-' }}</td>
                          <td class="px-2 py-2">{{ m.tipo_flete_nombre || '-' }}</td>
                          <td class="px-2 py-2">{{ m.centro_costo || '-' }}</td>
                          <td class="px-2 py-2">{{ formatFecha(m.fecha_salida) }}</td>
                          <td class="px-2 py-2 text-right font-semibold">{{ formatCLP(m.monto_aplicado) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- PASO 4: Confirmación -->
      @if (step() === 4) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <h2 class="text-base font-semibold text-forest-900">Paso 4 — Confirmar generación</h2>

          @if (generando()) {
            <p class="mt-6 text-sm text-forest-600">Generando pre facturas, por favor espera...</p>
          } @else if (errorGeneracion()) {
            <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ errorGeneracion() }}</div>
          } @else {
            <div class="mt-4 rounded-xl border border-forest-100 bg-forest-50 p-4 space-y-1">
              <p class="text-sm text-forest-700">
                Se generarán <strong>{{ preview()?.cantidad_facturas ?? 0 }}</strong> pre factura(s)
                para <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>,
                agrupadas por <strong>Centro de Costo</strong>.
              </p>
              @if (periodoDesde() || periodoHasta()) {
                <p class="text-sm text-forest-700">
                  Período:
                  <strong>{{ periodoDesde() ? formatFecha(periodoDesde()) : '…' }} – {{ periodoHasta() ? formatFecha(periodoHasta()) : '…' }}</strong>
                </p>
              }
              <p class="text-sm text-forest-700">
                Total estimado: <strong>{{ totalPreview() }}</strong>.
              </p>
            </div>
            <p class="mt-4 text-sm text-forest-600">
              Esta acción marcará todos los movimientos incluidos como <em>Facturado</em>.
              Las facturas se crearán en estado <strong>Borrador</strong>.
              Desde el detalle de cada pre factura podrás marcarlas como recibidas.
            </p>
          }
        </div>
      }

      <!-- Botones de navegación -->
      <div class="mt-6 flex items-center justify-between">
        <div class="flex gap-3">
          @if (step() > 1) {
            <button type="button"
                    (click)="pasoAnterior()"
                    [disabled]="generando()"
                    class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50 disabled:opacity-50">
              Atrás
            </button>
          }
          <a routerLink="/facturas"
             class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
            Cancelar
          </a>
        </div>

        <div>
          @if (step() < 3) {
            <button type="button"
                    (click)="pasoContinuar()"
                    [disabled]="!puedeContinuar()"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Continuar
            </button>
          }
          @if (step() === 3) {
            <button type="button"
                    (click)="irAConfirmar()"
                    [disabled]="loadingPreview() || !preview()"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Revisar y confirmar
            </button>
          }
          @if (step() === 4 && !generando() && !errorGeneracion()) {
            <button type="button"
                    (click)="confirmarGeneracion()"
                    class="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">
              Generar pre facturas
            </button>
          }
        </div>
      </div>

    </app-workspace-shell>
  `
})
export class NuevaFacturaWizardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly steps = [
    { n: 1 as Step, label: 'Transportista y período' },
    { n: 2 as Step, label: 'Resumen folios' },
    { n: 3 as Step, label: 'Vista previa' },
    { n: 4 as Step, label: 'Confirmar' },
  ];

  readonly step                = signal<Step>(1);
  readonly empresas            = signal<EmpresaElegible[]>([]);
  readonly folios              = signal<FolioElegible[]>([]);
  readonly empresaSeleccionada = signal<EmpresaElegible | null>(null);
  readonly periodos            = signal<PeriodoDisponible[]>([]);
  readonly periodoSeleccionado = signal<PeriodoDisponible | null>(null);
  readonly periodoDesde        = signal<string>('');
  readonly periodoHasta        = signal<string>('');
  readonly preview             = signal<PreviewResult | null>(null);
  readonly loadingEmpresas     = signal(false);
  readonly loadingPeriodos     = signal(false);
  readonly loadingFolios       = signal(false);
  readonly loadingPreview      = signal(false);
  readonly generando           = signal(false);
  readonly errorPreview        = signal('');
  readonly errorGeneracion     = signal('');

  readonly totalFolios = computed(() => {
    const total = this.folios().reduce((s, f) => s + (f.monto_neto_estimado || 0), 0);
    return this.formatCLP(total);
  });

  readonly totalMovimientosFolios = computed(() =>
    this.folios().reduce((s, f) => s + (f.total_movimientos || 0), 0)
  );

  readonly totalPreview = computed(() => {
    const total = (this.preview()?.grupos ?? []).reduce((s: number, g: GrupoPreview) => s + (g.monto_total || 0), 0);
    return this.formatCLP(total);
  });

  constructor(private cflApi: CflApiService, private router: Router) {}

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  cargarEmpresas(): void {
    this.loadingEmpresas.set(true);
    this.cflApi.getFacturasEmpresasElegibles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.empresas.set(res.data); this.loadingEmpresas.set(false); },
        error: () => this.loadingEmpresas.set(false),
      });
  }

  seleccionarEmpresa(emp: EmpresaElegible): void {
    this.empresaSeleccionada.set(emp);
    this.periodoSeleccionado.set(null);
    this.periodoDesde.set('');
    this.periodoHasta.set('');
    this.cargarPeriodos(emp.id_empresa);
  }

  private cargarPeriodos(idEmpresa: number): void {
    this.loadingPeriodos.set(true);
    this.periodos.set([]);
    this.cflApi.getFacturasPeriodosConMovimientos(idEmpresa)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.periodos.set(res.data); this.loadingPeriodos.set(false); },
        error: () => this.loadingPeriodos.set(false),
      });
  }

  seleccionarPeriodo(p: PeriodoDisponible): void {
    this.periodoSeleccionado.set(p);
    // Primer día del mes
    const desde = `${p.anio}-${String(p.mes).padStart(2, '0')}-01`;
    // Último día del mes
    const lastDay = new Date(p.anio, p.mes, 0).getDate();
    const hasta = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.periodoDesde.set(desde);
    this.periodoHasta.set(hasta);
  }

  cargarFolios(): void {
    const emp = this.empresaSeleccionada();
    if (!emp) return;
    this.loadingFolios.set(true);
    this.folios.set([]);
    this.cflApi.getFacturasFoliosElegibles(
      emp.id_empresa,
      this.periodoDesde() || undefined,
      this.periodoHasta() || undefined
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.folios.set(res.data); this.loadingFolios.set(false); },
        error: () => this.loadingFolios.set(false),
      });
  }

  calcularPreview(): void {
    const empresa = this.empresaSeleccionada();
    const ids = this.folios().map(f => f.id_folio);
    if (!empresa || !ids.length) return;

    this.loadingPreview.set(true);
    this.errorPreview.set('');
    this.preview.set(null);

    this.cflApi.getFacturaPreviewNueva({
      id_empresa: empresa.id_empresa,
      ids_folio:  ids,
      criterio:   CRITERIO_DEFECTO,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.preview.set(res.data); this.loadingPreview.set(false); },
        error: (err) => {
          this.errorPreview.set(err?.error?.error ?? 'Error al calcular la vista previa.');
          this.loadingPreview.set(false);
        },
      });
  }

  confirmarGeneracion(): void {
    const empresa = this.empresaSeleccionada();
    const ids = this.folios().map(f => f.id_folio);
    if (!empresa || !ids.length) return;

    this.generando.set(true);
    this.errorGeneracion.set('');

    this.cflApi.generarFacturas({
      id_empresa: empresa.id_empresa,
      ids_folio:  ids,
      criterio:   CRITERIO_DEFECTO,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.generando.set(false); this.router.navigate(['/facturas']); },
        error: (err) => {
          this.errorGeneracion.set(err?.error?.error ?? 'Error al generar pre facturas.');
          this.generando.set(false);
        },
      });
  }

  // --- Navegación ---

  puedeContinuar(): boolean {
    if (this.step() === 1) return this.empresaSeleccionada() !== null && this.periodoSeleccionado() !== null;
    if (this.step() === 2) return this.folios().length > 0;
    return false;
  }

  puedeIrAStep(n: Step): boolean {
    return n <= this.step();
  }

  irAStep(n: Step): void {
    if (!this.puedeIrAStep(n)) return;
    this.step.set(n);
  }

  pasoContinuar(): void {
    const next = (this.step() + 1) as Step;
    if (next === 2) {
      this.cargarFolios();
    }
    if (next === 3) {
      this.calcularPreview();
    }
    this.step.set(next);
  }

  irAConfirmar(): void {
    this.step.set(4);
  }

  pasoAnterior(): void {
    this.step.set((this.step() - 1) as Step);
  }

  // --- Helpers ---
  readonly formatCLP   = formatCLP;
  readonly formatFecha = formatDate;

  readonly nombreMes = nombreMes;
}
