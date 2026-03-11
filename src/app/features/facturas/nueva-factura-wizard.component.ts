
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  CriterioAgrupacion,
  EmpresaElegible,
  FolioElegible,
  GrupoPreview,
  PreviewResult,
} from '../../core/models/factura.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

type Step = 1 | 2 | 3 | 4 | 5;

@Component({
    selector: 'app-nueva-factura-wizard',
    imports: [FormsModule, RouterLink, WorkspaceShellComponent],
    template: `
    <app-workspace-shell title="Nueva Factura" subtitle="Generación de facturas internas de transporte." activeSection="facturas">

      <!-- Stepper -->
      <nav class="mb-8 flex items-center gap-0 overflow-x-auto">
        @for (s of steps; track s.n) {
          <div class="flex items-center">
            <button type="button"
                    (click)="irAStep(s.n)"
                    [disabled]="!puedeIrAStep(s.n)"
                    class="flex items-center gap-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-default"
                    [class.text-teal-700]="step() === s.n"
                    [class.text-forest-900]="step() > s.n && step() !== s.n"
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
            @if (s.n < 5) {
              <span class="mx-1 text-forest-300">›</span>
            }
          </div>
        }
      </nav>

      <!-- PASO 1: Empresa -->
      @if (step() === 1) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <h2 class="text-base font-semibold text-forest-900">Paso 1 — Selecciona empresa transportista</h2>
          <p class="mt-1 text-sm text-forest-500">Solo se muestran empresas con folios en estado "Asignado Folio" sin factura activa.</p>

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
      }

      <!-- PASO 2: Folios -->
      @if (step() === 2) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <h2 class="text-base font-semibold text-forest-900">Paso 2 — Selecciona folios</h2>
          <p class="mt-1 text-sm text-forest-500">
            Empresa: <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>
          </p>

          @if (loadingFolios()) {
            <p class="mt-6 text-sm text-forest-500">Cargando folios...</p>
          } @else if (folios().length === 0) {
            <div class="mt-6 rounded-xl border border-dashed border-forest-200 px-5 py-8 text-center text-sm text-forest-500">
              No hay folios elegibles para esta empresa.
            </div>
          } @else {
            <div class="mt-5 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-3 py-3 w-10">
                      <input type="checkbox"
                             [checked]="todosSeleccionados()"
                             (change)="toggleTodos($any($event.target).checked)"
                             class="rounded" />
                    </th>
                    <th class="px-3 py-3">Folio</th>
                    <th class="px-3 py-3">Centro de Costo</th>
                    <th class="px-3 py-3">Tipo Flete Principal</th>
                    <th class="px-3 py-3 text-center">Movimientos</th>
                    <th class="px-3 py-3 text-right">Monto Estimado</th>
                    <th class="px-3 py-3">Periodo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (folio of folios(); track folio.id_folio) {
                    <tr [class.bg-teal-50]="esFolioSeleccionado(folio.id_folio)" class="transition">
                      <td class="px-3 py-3">
                        <input type="checkbox"
                               [checked]="esFolioSeleccionado(folio.id_folio)"
                               (change)="toggleFolio(folio, $any($event.target).checked)"
                               class="rounded" />
                      </td>
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
            <p class="mt-3 text-sm text-forest-600">
              {{ foliosSeleccionados().length }} folio(s) seleccionado(s)
            </p>
          }
        </div>
      }

      <!-- PASO 3: Criterio de agrupación -->
      @if (step() === 3) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <h2 class="text-base font-semibold text-forest-900">Paso 3 — Criterio de agrupación</h2>
          <p class="mt-1 text-sm text-forest-500">¿Cómo deseas agrupar los movimientos en facturas?</p>

          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button"
                    (click)="criterio.set('centro_costo')"
                    class="rounded-2xl border p-5 text-left transition"
                    [class.border-teal-500]="criterio() === 'centro_costo'"
                    [class.bg-teal-50]="criterio() === 'centro_costo'"
                    [class.border-forest-200]="criterio() !== 'centro_costo'"
                    [class.hover:border-forest-400]="criterio() !== 'centro_costo'">
              <p class="font-semibold text-forest-900">Por Centro de Costo</p>
              <p class="mt-1 text-sm text-forest-500">Una factura por cada centro de costo distinto entre los folios seleccionados.</p>
            </button>

            <button type="button"
                    (click)="criterio.set('tipo_flete')"
                    class="rounded-2xl border p-5 text-left transition"
                    [class.border-teal-500]="criterio() === 'tipo_flete'"
                    [class.bg-teal-50]="criterio() === 'tipo_flete'"
                    [class.border-forest-200]="criterio() !== 'tipo_flete'"
                    [class.hover:border-forest-400]="criterio() !== 'tipo_flete'">
              <p class="font-semibold text-forest-900">Por Tipo de Flete</p>
              <p class="mt-1 text-sm text-forest-500">Una factura por cada tipo de flete predominante entre los folios seleccionados.</p>
            </button>
          </div>
        </div>
      }

      <!-- PASO 4: Vista previa -->
      @if (step() === 4) {
        <div class="space-y-5">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-base font-semibold text-forest-900">Paso 4 — Vista previa de generación</h2>
            <p class="mt-1 text-sm text-forest-500">
              Se generarán <strong>{{ preview()?.cantidad_facturas ?? 0 }}</strong> factura(s) agrupadas por
              <strong>{{ criterioLabel(criterio()) }}</strong>.
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
              <div class="rounded-2xl border p-5 shadow-sm"
                   [class.border-teal-200]="criterio() === 'centro_costo'"
                   [class.bg-teal-50]="criterio() === 'centro_costo'"
                   [class.border-amber-200]="criterio() === 'tipo_flete'"
                   [class.bg-amber-50]="criterio() === 'tipo_flete'">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          [class.bg-teal-200]="criterio() === 'centro_costo'"
                          [class.text-teal-800]="criterio() === 'centro_costo'"
                          [class.bg-amber-200]="criterio() === 'tipo_flete'"
                          [class.text-amber-800]="criterio() === 'tipo_flete'">
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

                <!-- Resumen movimientos del grupo -->
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

      <!-- PASO 5: Confirmación -->
      @if (step() === 5) {
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <h2 class="text-base font-semibold text-forest-900">Paso 5 — Confirmar generación</h2>

          @if (generando()) {
            <p class="mt-6 text-sm text-forest-600">Generando facturas, por favor espera...</p>
          } @else if (errorGeneracion()) {
            <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ errorGeneracion() }}</div>
          } @else {
            <div class="mt-4 rounded-xl border border-forest-100 bg-forest-50 p-4">
              <p class="text-sm text-forest-700">
                Se generarán <strong>{{ preview()?.cantidad_facturas ?? 0 }}</strong> factura(s)
                para <strong>{{ empresaSeleccionada()?.empresa_nombre }}</strong>,
                agrupadas por <strong>{{ criterioLabel(criterio()) }}</strong>,
                con un total estimado de <strong>{{ totalPreview() }}</strong>.
              </p>
            </div>
            <p class="mt-4 text-sm text-forest-600">
              Esta acción marcará todos los movimientos incluidos como <em>Facturado</em>.
              Las facturas se crearán en estado <strong>Borrador</strong> y pueden ser editadas antes de emitirse.
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
          @if (step() < 4) {
            <button type="button"
                    (click)="pasoContinuar()"
                    [disabled]="!puedeContinuar()"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Continuar
            </button>
          }
          @if (step() === 4) {
            <button type="button"
                    (click)="irAConfirmar()"
                    [disabled]="loadingPreview() || !preview()"
                    class="rounded-xl bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-700 disabled:opacity-50">
              Revisar y confirmar
            </button>
          }
          @if (step() === 5 && !generando() && !errorGeneracion()) {
            <button type="button"
                    (click)="confirmarGeneracion()"
                    class="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">
              Generar facturas
            </button>
          }
        </div>
      </div>

    </app-workspace-shell>
  `
})
export class NuevaFacturaWizardComponent implements OnInit {
  readonly steps = [
    { n: 1 as Step, label: 'Empresa' },
    { n: 2 as Step, label: 'Folios' },
    { n: 3 as Step, label: 'Criterio' },
    { n: 4 as Step, label: 'Vista previa' },
    { n: 5 as Step, label: 'Confirmar' },
  ];

  readonly step             = signal<Step>(1);
  readonly empresas         = signal<EmpresaElegible[]>([]);
  readonly folios           = signal<FolioElegible[]>([]);
  readonly empresaSeleccionada = signal<EmpresaElegible | null>(null);
  readonly foliosSeleccionados = signal<FolioElegible[]>([]);
  readonly criterio         = signal<CriterioAgrupacion>('centro_costo');
  readonly preview          = signal<PreviewResult | null>(null);
  readonly loadingEmpresas  = signal(false);
  readonly loadingFolios    = signal(false);
  readonly loadingPreview   = signal(false);
  readonly generando        = signal(false);
  readonly errorPreview     = signal('');
  readonly errorGeneracion  = signal('');

  readonly todosSeleccionados = computed(() => {
    const folios = this.folios();
    return folios.length > 0 && folios.every(f => this.esFolioSeleccionado(f.id_folio));
  });

  readonly totalPreview = computed(() => {
    const grupos = this.preview()?.grupos ?? [];
    const total  = grupos.reduce((s, g) => s + (g.monto_total || 0), 0);
    return this.formatCLP(total);
  });

  constructor(private cflApi: CflApiService, private router: Router) {}

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  cargarEmpresas(): void {
    this.loadingEmpresas.set(true);
    this.cflApi.getFacturasEmpresasElegibles().subscribe({
      next: (res) => {
        this.empresas.set(res.data as EmpresaElegible[]);
        this.loadingEmpresas.set(false);
      },
      error: () => this.loadingEmpresas.set(false),
    });
  }

  seleccionarEmpresa(emp: EmpresaElegible): void {
    this.empresaSeleccionada.set(emp);
  }

  cargarFolios(idEmpresa: number): void {
    this.loadingFolios.set(true);
    this.folios.set([]);
    this.foliosSeleccionados.set([]);
    this.cflApi.getFacturasFoliosElegibles(idEmpresa).subscribe({
      next: (res) => {
        this.folios.set(res.data as FolioElegible[]);
        this.loadingFolios.set(false);
      },
      error: () => this.loadingFolios.set(false),
    });
  }

  esFolioSeleccionado(idFolio: number): boolean {
    return this.foliosSeleccionados().some(f => f.id_folio === idFolio);
  }

  toggleFolio(folio: FolioElegible, checked: boolean): void {
    if (checked) {
      this.foliosSeleccionados.update(list => [...list, folio]);
    } else {
      this.foliosSeleccionados.update(list => list.filter(f => f.id_folio !== folio.id_folio));
    }
  }

  toggleTodos(checked: boolean): void {
    this.foliosSeleccionados.set(checked ? [...this.folios()] : []);
  }

  calcularPreview(): void {
    const empresa = this.empresaSeleccionada();
    const folios  = this.foliosSeleccionados();
    if (!empresa || !folios.length) return;

    this.loadingPreview.set(true);
    this.errorPreview.set('');
    this.preview.set(null);

    this.cflApi.getFacturaPreviewNueva({
      id_empresa: empresa.id_empresa,
      ids_folio:  folios.map(f => f.id_folio),
      criterio:   this.criterio(),
    }).subscribe({
      next: (res) => {
        this.preview.set(res.data as PreviewResult);
        this.loadingPreview.set(false);
      },
      error: (err) => {
        this.errorPreview.set(err?.error?.error ?? 'Error al calcular la vista previa.');
        this.loadingPreview.set(false);
      },
    });
  }

  confirmarGeneracion(): void {
    const empresa = this.empresaSeleccionada();
    const folios  = this.foliosSeleccionados();
    if (!empresa || !folios.length) return;

    this.generando.set(true);
    this.errorGeneracion.set('');

    this.cflApi.generarFacturas({
      id_empresa: empresa.id_empresa,
      ids_folio:  folios.map(f => f.id_folio),
      criterio:   this.criterio(),
    }).subscribe({
      next: () => {
        this.generando.set(false);
        this.router.navigate(['/facturas']);
      },
      error: (err) => {
        this.errorGeneracion.set(err?.error?.error ?? 'Error al generar facturas.');
        this.generando.set(false);
      },
    });
  }

  // --- Navegación ---

  puedeContinuar(): boolean {
    if (this.step() === 1) return this.empresaSeleccionada() !== null;
    if (this.step() === 2) return this.foliosSeleccionados().length > 0;
    if (this.step() === 3) return true;
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
      const emp = this.empresaSeleccionada();
      if (emp) this.cargarFolios(emp.id_empresa);
    }
    if (next === 4) {
      this.calcularPreview();
    }
    this.step.set(next);
  }

  irAConfirmar(): void {
    this.step.set(5);
  }

  pasoAnterior(): void {
    const prev = (this.step() - 1) as Step;
    this.step.set(prev);
  }

  // --- Helpers ---

  criterioLabel(c: CriterioAgrupacion | null): string {
    if (c === 'centro_costo') return 'Centro de Costo';
    if (c === 'tipo_flete')   return 'Tipo de Flete';
    return '-';
  }

  formatCLP(v: unknown): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
      .format(Number(v) || 0);
  }

  formatFecha(v: unknown): string {
    if (!v) return '-';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat('es-CL').format(d);
  }
}
