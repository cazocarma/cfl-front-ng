
import { Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EmpresaElegible, GrupoSugerido, MovimientoElegible, PeriodoDisponible } from '../../core/models/factura.model';
import { nombreMes } from '../../core/constants/factura.constants';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

type Step = 1 | 2 | 3;

interface GrupoPrefactura {
  id: string;
  label: string;
  ids: Set<number>;
}

@Component({
    selector: 'app-nueva-factura-wizard',
    imports: [FormsModule, RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell title="Nueva Pre Factura" subtitle="Generacion de pre facturas de transporte por periodo y tipo de flete." activeSection="facturas">

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
            @if (s.n < 3) {
              <span class="mx-1 text-forest-300">></span>
            }
          </div>
        }
      </nav>

      <!-- PASO 1: Empresa + Periodo -->
      @if (step() === 1) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-forest-900">Paso 1 -- Transportista y periodo</h2>
            <p class="mt-1 text-sm text-forest-500">Selecciona la empresa transportista e indica el periodo de los movimientos a pre facturar.</p>

            @if (loadingEmpresas()) {
              <p class="mt-6 text-sm text-forest-500">Cargando empresas...</p>
            } @else if (empresas().length === 0) {
              <div class="mt-6 rounded-xl border border-dashed border-forest-200 px-5 py-8 text-center text-sm text-forest-500">
                No hay empresas con movimientos elegibles en este momento.
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
                      {{ emp.movimientos_disponibles }} movimiento(s) disponible(s)
                    </span>
                  </button>
                }
              </div>
            }
          </div>

          <!-- Periodo -->
          @if (empresaSeleccionada()) {
            <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
              <h3 class="text-sm font-semibold text-forest-900">Periodo de pre facturacion</h3>
              <p class="mt-1 text-xs text-forest-500">
                Selecciona el mes con movimientos a incluir en la pre factura.
              </p>

              @if (loadingPeriodos()) {
                <p class="mt-5 text-sm text-forest-500">Cargando periodos...</p>
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

      <!-- PASO 2: Agrupacion interactiva de movimientos -->
      @if (step() === 2) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-forest-900">Paso 2 -- Agrupacion de movimientos</h2>
                <p class="mt-1 text-sm text-forest-500">
                  Empresa: <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>
                  &nbsp;--&nbsp;Periodo:
                  <strong>{{ periodoDesde() ? formatFecha(periodoDesde()) : '...' }} -- {{ periodoHasta() ? formatFecha(periodoHasta()) : '...' }}</strong>
                </p>
                <p class="mt-1 text-xs text-forest-400">
                  Los movimientos se agruparon automaticamente por tipo de flete. Puedes reorganizar los grupos antes de generar.
                </p>
              </div>
              <div class="rounded-xl bg-forest-50 border border-forest-100 px-4 py-2 text-right text-sm">
                <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Total general</p>
                <p class="text-lg font-bold text-teal-700">{{ totalGeneral() }}</p>
                <p class="text-xs text-forest-500">{{ allMovimientos().length }} movimiento(s) en {{ grupos().length }} grupo(s)</p>
              </div>
            </div>
          </div>

          @if (loadingMovimientos()) {
            <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
              Cargando movimientos elegibles...
            </div>
          } @else {

            <!-- Grupos de pre factura -->
            @for (grupo of grupos(); track grupo.id; let gi = $index) {
              <div class="rounded-2xl border border-teal-200 bg-white shadow-sm">
                <!-- Header del grupo -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-teal-50 px-5 py-4 rounded-t-2xl">
                  <div class="flex items-center gap-3">
                    <span class="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                      {{ gi + 1 }}
                    </span>
                    <div>
                      <input type="text"
                             [ngModel]="grupo.label"
                             (ngModelChange)="updateGroupLabel(grupo.id, $event)"
                             class="border-0 border-b border-transparent bg-transparent px-0 py-0 text-sm font-semibold text-forest-900 outline-none transition focus:border-teal-500"
                      />
                      <p class="text-xs text-forest-500">{{ grupo.ids.size }} movimiento(s)</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-forest-500 uppercase tracking-widest">Total grupo</p>
                    <p class="text-lg font-bold text-teal-700">{{ grupoTotal(grupo.id) }}</p>
                    <p class="text-xs text-forest-500">
                      Neto {{ grupoNeto(grupo.id) }} + IVA {{ grupoIva(grupo.id) }}
                    </p>
                  </div>
                </div>

                <!-- Tabla de movimientos del grupo -->
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-forest-100 text-xs">
                    <thead>
                      <tr class="text-left font-semibold uppercase tracking-[0.18em] text-forest-500">
                        <th class="px-3 py-2">
                          <input type="checkbox"
                                 [checked]="isAllGroupChecked(grupo.id)"
                                 (change)="toggleAllGroup(grupo.id)"
                                 class="rounded border-forest-300 text-teal-600 focus:ring-teal-500"
                          />
                        </th>
                        <th class="px-3 py-2">Guia / Entrega</th>
                        <th class="px-3 py-2">Tipo Flete</th>
                        <th class="px-3 py-2">Centro Costo</th>
                        <th class="px-3 py-2">Fecha</th>
                        <th class="px-3 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-100">
                      @for (m of getMovimientosDeGrupo(grupo.id); track m.id_cabecera_flete) {
                        <tr class="hover:bg-forest-50 transition">
                          <td class="px-3 py-2">
                            <input type="checkbox"
                                   [checked]="checkedMovimientos().has(m.id_cabecera_flete)"
                                   (change)="toggleCheck(m.id_cabecera_flete)"
                                   class="rounded border-forest-300 text-teal-600 focus:ring-teal-500"
                            />
                          </td>
                          <td class="px-3 py-2 font-medium text-forest-900">{{ m.guia_remision || m.sap_numero_entrega || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ m.tipo_flete_nombre || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ m.centro_costo_codigo ? m.centro_costo_codigo + ' - ' : '' }}{{ m.centro_costo || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ formatFecha(m.fecha_salida) }}</td>
                          <td class="px-3 py-2 text-right font-semibold text-forest-900">{{ formatCLP(m.monto_aplicado) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Acciones del grupo -->
                <div class="flex flex-wrap items-center gap-2 border-t border-forest-100 px-5 py-3">
                  @if (getCheckedInGroup(grupo.id).length > 0) {
                    <button type="button"
                            (click)="quitarSeleccionados(grupo.id)"
                            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                      Desasignar seleccionados ({{ getCheckedInGroup(grupo.id).length }})
                    </button>
                    <!-- Mover a otro grupo -->
                    @if (grupos().length > 1) {
                      <span class="text-xs text-forest-400">Mover a:</span>
                      @for (otroGrupo of grupos(); track otroGrupo.id) {
                        @if (otroGrupo.id !== grupo.id) {
                          <button type="button"
                                  (click)="moverSeleccionados(grupo.id, otroGrupo.id)"
                                  class="rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 transition hover:bg-forest-50">
                            {{ otroGrupo.label }}
                          </button>
                        }
                      }
                    }
                  }
                  <div class="ml-auto">
                    @if (grupo.ids.size === 0) {
                      <button type="button"
                              (click)="eliminarGrupo(grupo.id)"
                              class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100">
                        Eliminar grupo
                      </button>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- Movimientos sin asignar -->
            @if (sinAsignar().length > 0) {
              <div class="rounded-2xl border border-amber-200 bg-white shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4 rounded-t-2xl">
                  <div>
                    <h3 class="text-sm font-semibold text-amber-800">Sin asignar</h3>
                    <p class="text-xs text-amber-600">{{ sinAsignar().length }} movimiento(s) sin grupo</p>
                  </div>
                </div>

                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-forest-100 text-xs">
                    <thead>
                      <tr class="text-left font-semibold uppercase tracking-[0.18em] text-forest-500">
                        <th class="px-3 py-2">
                          <input type="checkbox"
                                 [checked]="isAllUnassignedChecked()"
                                 (change)="toggleAllUnassigned()"
                                 class="rounded border-forest-300 text-amber-600 focus:ring-amber-500"
                          />
                        </th>
                        <th class="px-3 py-2">Guia / Entrega</th>
                        <th class="px-3 py-2">Tipo Flete</th>
                        <th class="px-3 py-2">Centro Costo</th>
                        <th class="px-3 py-2">Fecha</th>
                        <th class="px-3 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-100">
                      @for (m of sinAsignar(); track m.id_cabecera_flete) {
                        <tr class="hover:bg-amber-50/50 transition">
                          <td class="px-3 py-2">
                            <input type="checkbox"
                                   [checked]="checkedMovimientos().has(m.id_cabecera_flete)"
                                   (change)="toggleCheck(m.id_cabecera_flete)"
                                   class="rounded border-forest-300 text-amber-600 focus:ring-amber-500"
                            />
                          </td>
                          <td class="px-3 py-2 font-medium text-forest-900">{{ m.guia_remision || m.sap_numero_entrega || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ m.tipo_flete_nombre || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ m.centro_costo_codigo ? m.centro_costo_codigo + ' - ' : '' }}{{ m.centro_costo || '-' }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ formatFecha(m.fecha_salida) }}</td>
                          <td class="px-3 py-2 text-right font-semibold text-forest-900">{{ formatCLP(m.monto_aplicado) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Acciones sin asignar -->
                <div class="flex flex-wrap items-center gap-2 border-t border-forest-100 px-5 py-3">
                  @if (getCheckedUnassigned().length > 0) {
                    <span class="text-xs text-forest-400">Asignar a:</span>
                    @for (grupo of grupos(); track grupo.id) {
                      <button type="button"
                              (click)="moverSeleccionadosDesdeUnassigned(grupo.id)"
                              class="rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 transition hover:bg-forest-50">
                        {{ grupo.label }}
                      </button>
                    }
                  }
                </div>
              </div>
            }

            <!-- Barra de acciones general -->
            <div class="flex flex-wrap items-center gap-3">
              <button type="button"
                      (click)="crearNuevoGrupo()"
                      class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50">
                + Crear nuevo grupo
              </button>
            </div>
          }
        </div>
      }

      <!-- PASO 3: Confirmar y generar -->
      @if (step() === 3) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-forest-900">Paso 3 -- Confirmar y generar</h2>
            <p class="mt-1 text-sm text-forest-500">
              Se generaran <strong>{{ gruposConMovimientos().length }}</strong> pre factura(s)
              para <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>.
            </p>

            @if (sinAsignar().length > 0) {
              <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                Hay {{ sinAsignar().length }} movimiento(s) sin asignar que no seran incluidos.
              </div>
            }
          </div>

          <!-- Resumen de cada grupo -->
          @for (grupo of gruposConMovimientos(); track grupo.id; let gi = $index) {
            <div class="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span class="rounded-full bg-teal-200 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                    Pre Factura {{ gi + 1 }}: {{ grupo.label }}
                  </span>
                  <p class="mt-2 text-sm font-semibold text-forest-900">
                    {{ grupo.ids.size }} movimiento(s)
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-forest-500 uppercase tracking-widest">Monto total</p>
                  <p class="text-xl font-bold text-teal-700">{{ grupoTotal(grupo.id) }}</p>
                  <p class="text-xs text-forest-500">Neto {{ grupoNeto(grupo.id) }} + IVA {{ grupoIva(grupo.id) }}</p>
                </div>
              </div>

              <div class="mt-4 overflow-x-auto">
                <table class="min-w-full divide-y divide-forest-200 text-xs">
                  <thead>
                    <tr class="text-left font-semibold uppercase tracking-[0.18em] text-forest-500">
                      <th class="px-2 py-2">Guia / Entrega</th>
                      <th class="px-2 py-2">Tipo Flete</th>
                      <th class="px-2 py-2">Centro Costo</th>
                      <th class="px-2 py-2">Fecha</th>
                      <th class="px-2 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-forest-200">
                    @for (m of getMovimientosDeGrupo(grupo.id); track m.id_cabecera_flete) {
                      <tr>
                        <td class="px-2 py-2 font-medium text-forest-900">{{ m.guia_remision || m.sap_numero_entrega || '-' }}</td>
                        <td class="px-2 py-2 text-forest-600">{{ m.tipo_flete_nombre || '-' }}</td>
                        <td class="px-2 py-2 text-forest-600">{{ m.centro_costo || '-' }}</td>
                        <td class="px-2 py-2 text-forest-600">{{ formatFecha(m.fecha_salida) }}</td>
                        <td class="px-2 py-2 text-right font-semibold">{{ formatCLP(m.monto_aplicado) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @if (generando()) {
            <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
              Generando pre facturas, por favor espera...
            </div>
          }
          @if (errorGeneracion()) {
            <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ errorGeneracion() }}</div>
          }
        </div>
      }

      <!-- Botones de navegacion -->
      <div class="mt-6 flex items-center justify-between">
        <div class="flex gap-3">
          @if (step() > 1) {
            <button type="button"
                    (click)="pasoAnterior()"
                    [disabled]="generando()"
                    class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50 disabled:opacity-50">
              Atras
            </button>
          }
          <a routerLink="/facturas"
             class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
            Cancelar
          </a>
        </div>

        <div>
          @if (step() === 1) {
            <button type="button"
                    (click)="pasoContinuar()"
                    [disabled]="!puedeContinuar()"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Continuar
            </button>
          }
          @if (step() === 2) {
            <button type="button"
                    (click)="irAConfirmar()"
                    [disabled]="gruposConMovimientos().length === 0"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Revisar y confirmar
            </button>
          }
          @if (step() === 3 && !generando()) {
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
    { n: 1 as Step, label: 'Transportista y periodo' },
    { n: 2 as Step, label: 'Agrupacion' },
    { n: 3 as Step, label: 'Confirmar' },
  ];

  readonly step                = signal<Step>(1);
  readonly empresas            = signal<EmpresaElegible[]>([]);
  readonly empresaSeleccionada = signal<EmpresaElegible | null>(null);
  readonly periodos            = signal<PeriodoDisponible[]>([]);
  readonly periodoSeleccionado = signal<PeriodoDisponible | null>(null);
  readonly periodoDesde        = signal<string>('');
  readonly periodoHasta        = signal<string>('');

  readonly loadingEmpresas     = signal(false);
  readonly loadingPeriodos     = signal(false);
  readonly loadingMovimientos  = signal(false);
  readonly generando           = signal(false);
  readonly errorGeneracion     = signal('');

  // Step 2 state: all movements and groups
  readonly allMovimientos      = signal<MovimientoElegible[]>([]);
  readonly grupos              = signal<GrupoPrefactura[]>([]);
  readonly checkedMovimientos  = signal<Set<number>>(new Set());

  private groupCounter = 0;

  // Computed: movements not assigned to any group
  readonly sinAsignar = computed(() => {
    const assigned = new Set<number>();
    for (const g of this.grupos()) {
      for (const id of g.ids) assigned.add(id);
    }
    return this.allMovimientos().filter(m => !assigned.has(m.id_cabecera_flete));
  });

  // Computed: groups that have at least one movement
  readonly gruposConMovimientos = computed(() =>
    this.grupos().filter(g => g.ids.size > 0)
  );

  // Computed: total general across all movements
  readonly totalGeneral = computed(() => {
    const total = this.allMovimientos().reduce((s, m) => s + (m.monto_aplicado || 0), 0);
    return this.formatCLP(total);
  });

  constructor(private cflApi: CflApiService, private router: Router) {}

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  // --- Step 1 ---

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
    const desde = `${p.anio}-${String(p.mes).padStart(2, '0')}-01`;
    const lastDay = new Date(p.anio, p.mes, 0).getDate();
    const hasta = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.periodoDesde.set(desde);
    this.periodoHasta.set(hasta);
  }

  // --- Step 2: Load movements and build initial groups ---

  private cargarMovimientos(): void {
    const emp = this.empresaSeleccionada();
    if (!emp) return;
    this.loadingMovimientos.set(true);
    this.allMovimientos.set([]);
    this.grupos.set([]);
    this.checkedMovimientos.set(new Set());
    this.groupCounter = 0;

    this.cflApi.getMovimientosElegibles(
      emp.id_empresa,
      this.periodoDesde(),
      this.periodoHasta()
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const { movimientos, grupos_sugeridos } = res.data;
          this.allMovimientos.set(movimientos);

          // Build initial groups from API suggestions (by tipo_flete)
          const initialGroups: GrupoPrefactura[] = grupos_sugeridos.map((gs: GrupoSugerido) => {
            this.groupCounter++;
            return {
              id: `grupo-${this.groupCounter}`,
              label: gs.tipo_flete_nombre,
              ids: new Set(gs.ids_cabecera_flete),
            };
          });

          // If no suggestions, create a single group with all movements
          if (initialGroups.length === 0 && movimientos.length > 0) {
            this.groupCounter++;
            initialGroups.push({
              id: `grupo-${this.groupCounter}`,
              label: 'Grupo 1',
              ids: new Set(movimientos.map((m: MovimientoElegible) => m.id_cabecera_flete)),
            });
          }

          this.grupos.set(initialGroups);
          this.loadingMovimientos.set(false);
        },
        error: () => this.loadingMovimientos.set(false),
      });
  }

  // --- Group management ---

  getMovimientosDeGrupo(grupoId: string): MovimientoElegible[] {
    const grupo = this.grupos().find(g => g.id === grupoId);
    if (!grupo) return [];
    return this.allMovimientos().filter(m => grupo.ids.has(m.id_cabecera_flete));
  }

  updateGroupLabel(grupoId: string, newLabel: string): void {
    this.grupos.update(gs => gs.map(g =>
      g.id === grupoId ? { ...g, label: newLabel } : g
    ));
  }

  crearNuevoGrupo(): void {
    this.groupCounter++;
    const newGroup: GrupoPrefactura = {
      id: `grupo-${this.groupCounter}`,
      label: `Grupo ${this.groupCounter}`,
      ids: new Set(),
    };
    this.grupos.update(gs => [...gs, newGroup]);
  }

  eliminarGrupo(grupoId: string): void {
    this.grupos.update(gs => gs.filter(g => g.id !== grupoId));
  }

  // --- Checkbox handling ---

  toggleCheck(id: number): void {
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isAllGroupChecked(grupoId: string): boolean {
    const grupo = this.grupos().find(g => g.id === grupoId);
    if (!grupo || grupo.ids.size === 0) return false;
    const checked = this.checkedMovimientos();
    for (const id of grupo.ids) {
      if (!checked.has(id)) return false;
    }
    return true;
  }

  toggleAllGroup(grupoId: string): void {
    const grupo = this.grupos().find(g => g.id === grupoId);
    if (!grupo) return;
    const allChecked = this.isAllGroupChecked(grupoId);
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      for (const id of grupo.ids) {
        if (allChecked) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  isAllUnassignedChecked(): boolean {
    const unassigned = this.sinAsignar();
    if (unassigned.length === 0) return false;
    const checked = this.checkedMovimientos();
    return unassigned.every(m => checked.has(m.id_cabecera_flete));
  }

  toggleAllUnassigned(): void {
    const unassigned = this.sinAsignar();
    const allChecked = this.isAllUnassignedChecked();
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      for (const m of unassigned) {
        if (allChecked) next.delete(m.id_cabecera_flete);
        else next.add(m.id_cabecera_flete);
      }
      return next;
    });
  }

  getCheckedInGroup(grupoId: string): number[] {
    const grupo = this.grupos().find(g => g.id === grupoId);
    if (!grupo) return [];
    const checked = this.checkedMovimientos();
    return [...grupo.ids].filter(id => checked.has(id));
  }

  getCheckedUnassigned(): number[] {
    const checked = this.checkedMovimientos();
    return this.sinAsignar()
      .filter(m => checked.has(m.id_cabecera_flete))
      .map(m => m.id_cabecera_flete);
  }

  // --- Movement operations ---

  quitarSeleccionados(fromGrupoId: string): void {
    const toRemove = this.getCheckedInGroup(fromGrupoId);
    if (toRemove.length === 0) return;
    this.grupos.update(gs => gs.map(g => {
      if (g.id !== fromGrupoId) return g;
      const newIds = new Set(g.ids);
      for (const id of toRemove) newIds.delete(id);
      return { ...g, ids: newIds };
    }));
    // Clear checks for moved items
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      for (const id of toRemove) next.delete(id);
      return next;
    });
  }

  moverSeleccionados(fromGrupoId: string, toGrupoId: string): void {
    const toMove = this.getCheckedInGroup(fromGrupoId);
    if (toMove.length === 0) return;
    this.grupos.update(gs => gs.map(g => {
      if (g.id === fromGrupoId) {
        const newIds = new Set(g.ids);
        for (const id of toMove) newIds.delete(id);
        return { ...g, ids: newIds };
      }
      if (g.id === toGrupoId) {
        const newIds = new Set(g.ids);
        for (const id of toMove) newIds.add(id);
        return { ...g, ids: newIds };
      }
      return g;
    }));
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      for (const id of toMove) next.delete(id);
      return next;
    });
  }

  moverSeleccionadosDesdeUnassigned(toGrupoId: string): void {
    const toMove = this.getCheckedUnassigned();
    if (toMove.length === 0) return;
    this.grupos.update(gs => gs.map(g => {
      if (g.id === toGrupoId) {
        const newIds = new Set(g.ids);
        for (const id of toMove) newIds.add(id);
        return { ...g, ids: newIds };
      }
      return g;
    }));
    this.checkedMovimientos.update(s => {
      const next = new Set(s);
      for (const id of toMove) next.delete(id);
      return next;
    });
  }

  // --- Group totals ---

  grupoNeto(grupoId: string): string {
    const movs = this.getMovimientosDeGrupo(grupoId);
    const neto = movs.reduce((s, m) => s + (m.monto_aplicado || 0), 0);
    return this.formatCLP(neto);
  }

  grupoIva(grupoId: string): string {
    const movs = this.getMovimientosDeGrupo(grupoId);
    const neto = movs.reduce((s, m) => s + (m.monto_aplicado || 0), 0);
    return this.formatCLP(Math.round(neto * 0.19));
  }

  grupoTotal(grupoId: string): string {
    const movs = this.getMovimientosDeGrupo(grupoId);
    const neto = movs.reduce((s, m) => s + (m.monto_aplicado || 0), 0);
    return this.formatCLP(Math.round(neto * 1.19));
  }

  // --- Step 3: Confirm and generate ---

  confirmarGeneracion(): void {
    const empresa = this.empresaSeleccionada();
    const gruposPayload = this.gruposConMovimientos().map(g => ({
      ids_cabecera_flete: [...g.ids],
    }));
    if (!empresa || gruposPayload.length === 0) return;

    this.generando.set(true);
    this.errorGeneracion.set('');

    this.cflApi.generarFacturas({
      id_empresa: empresa.id_empresa,
      grupos: gruposPayload,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.generando.set(false); this.router.navigate(['/facturas']); },
        error: (err) => {
          this.errorGeneracion.set(err?.error?.error ?? 'Error al generar pre facturas.');
          this.generando.set(false);
        },
      });
  }

  // --- Navegacion ---

  puedeContinuar(): boolean {
    if (this.step() === 1) return this.empresaSeleccionada() !== null && this.periodoSeleccionado() !== null;
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
    if (this.step() === 1) {
      this.cargarMovimientos();
      this.step.set(2);
    }
  }

  irAConfirmar(): void {
    this.step.set(3);
  }

  pasoAnterior(): void {
    this.step.set((this.step() - 1) as Step);
  }

  // --- Helpers ---
  readonly formatCLP   = formatCLP;
  readonly formatFecha = formatDate;
  readonly nombreMes   = nombreMes;
}
