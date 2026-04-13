import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';

import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

Chart.register(...registerables);

interface DashboardData {
  resumen: Record<string, unknown>;
  estados: Array<{ estado: string; total: number; monto: number }>;
  transportistas: Array<{ empresa_nombre: string; total_movimientos: number; monto_total: number }>;
  centros_costo: Array<{ sap_codigo: string; nombre: string; total_movimientos: number; monto_total: number }>;
  productores: Array<{ codigo_proveedor: string; nombre: string; total_movimientos: number; monto_total: number }>;
  tipos_flete: Array<{ nombre: string; total_movimientos: number; monto_total: number }>;
  sentido: Array<{ tipo: string; total: number; monto: number }>;
  timeline: Array<{ periodo: string; total_fletes: number; monto_movimientos: number; total_facturas: number; monto_facturado: number }>;
}

const CHART_COLORS = {
  forest: '#1e4424',
  forestLight: '#2b6734',
  teal: '#0d9488',
  tealLight: '#14b8a6',
  amber: '#d97706',
  amberLight: '#f59e0b',
  blue: '#2563eb',
  blueLight: '#60a5fa',
  red: '#dc2626',
  slate: '#64748b',
  purple: '#7c3aed',
  pink: '#db2777',
};

const PALETTE = [
  CHART_COLORS.forest, CHART_COLORS.teal, CHART_COLORS.amber,
  CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.pink,
  CHART_COLORS.red, CHART_COLORS.slate,
];

@Component({
  selector: 'app-estadisticas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, WorkspaceShellComponent],
  template: `
    <app-workspace-shell title="Dashboard" subtitle="Panel ejecutivo de control de fletes — indicadores, tendencias y distribuciones." activeSection="estadisticas">

      @if (loading()) {
        <div class="rounded-2xl border border-forest-100 bg-white px-6 py-16 text-center text-sm text-forest-500 shadow-sm">
          Cargando dashboard...
        </div>
      } @else {

        <!-- KPI Cards Row 1 -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Total Fletes</p>
            <p class="mt-2 text-3xl font-bold text-forest-900">{{ n('total_fletes') | number }}</p>
            <p class="mt-1 text-xs text-forest-500">Movimientos registrados en el sistema</p>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Monto Total Fletes</p>
            <p class="mt-2 text-3xl font-bold text-teal-700">{{ clp(n('monto_total_fletes')) }}</p>
            <p class="mt-1 text-xs text-forest-500">Suma de todos los montos aplicados</p>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Pre Facturas</p>
            <p class="mt-2 text-3xl font-bold text-forest-900">{{ n('facturas_registradas') | number }}</p>
            <div class="mt-1 flex gap-3 text-xs">
              <span class="text-slate-600">{{ n('facturas_borrador') }} borrador</span>
              <span class="text-blue-600">{{ n('facturas_recibidas') }} recibidas</span>
            </div>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500">Monto Pre Facturado</p>
            <p class="mt-2 text-3xl font-bold text-teal-700">{{ clp(n('monto_facturado')) }}</p>
            <p class="mt-1 text-xs text-forest-500">Ticket promedio: {{ clp(n('ticket_promedio_factura')) }}</p>
          </div>
        </div>

        <!-- KPI Cards Row 2 -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <div class="rounded-2xl border border-forest-100 bg-forest-50 p-4 shadow-sm">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">Completados</p>
            <p class="mt-1 text-2xl font-bold text-forest-900">{{ n('fletes_completados') | number }}</p>
          </div>
          <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">En Revisión</p>
            <p class="mt-1 text-2xl font-bold text-amber-900">{{ n('fletes_en_revision') | number }}</p>
          </div>
          <div class="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">Pre Facturado</p>
            <p class="mt-1 text-2xl font-bold text-blue-900">{{ n('fletes_prefacturado') | number }}</p>
          </div>
          <div class="rounded-2xl border border-teal-100 bg-teal-50 p-4 shadow-sm">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">Facturados</p>
            <p class="mt-1 text-2xl font-bold text-teal-900">{{ n('fletes_facturados') | number }}</p>
          </div>
        </div>

        <!-- Charts Row: Timeline + Sentido -->
        <div class="grid gap-6 xl:grid-cols-[1fr,320px] mb-6">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Tendencia mensual — Fletes y facturación</h2>
            <div class="relative h-[280px]">
              <canvas #timelineChart></canvas>
            </div>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Despacho vs Retorno</h2>
            <div class="relative h-[240px] flex items-center justify-center">
              <canvas #sentidoChart></canvas>
            </div>
          </div>
        </div>

        <!-- Charts Row: Transportistas + Centros + Tipos -->
        <div class="grid gap-6 xl:grid-cols-2 mb-6">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Top transportistas por monto</h2>
            <div class="relative h-[260px]">
              <canvas #transportistasChart></canvas>
            </div>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Top centros de costo por monto</h2>
            <div class="relative h-[260px]">
              <canvas #centrosChart></canvas>
            </div>
          </div>
        </div>

        <div class="grid gap-6 xl:grid-cols-2 mb-6">
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Top productores por monto</h2>
            <div class="relative h-[260px]">
              <canvas #productoresChart></canvas>
            </div>
          </div>
          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900 mb-4">Distribución por tipo de flete</h2>
            <div class="relative h-[260px]">
              <canvas #tiposFleteChart></canvas>
            </div>
          </div>
        </div>

        <!-- Estados distribution bar -->
        <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm mb-6">
          <h2 class="text-sm font-semibold text-forest-900 mb-4">Distribución de estados</h2>
          <div class="relative h-[200px]">
            <canvas #estadosChart></canvas>
          </div>
        </div>

        <!-- Viajes por Chofer y Transportista -->
        <div class="rounded-2xl border border-forest-100 bg-white shadow-sm mb-6">
          <div class="flex flex-wrap items-center gap-3 border-b border-forest-100 px-5 py-4">
            <h2 class="text-sm font-semibold text-forest-900 flex-shrink-0">Viajes por Chofer y Transportista</h2>
            <div class="flex-1"></div>
            <select class="cfl-select w-48 text-xs" [value]="viajesTemporadaId()" (change)="viajesTemporadaId.set($any($event.target).value); loadViajes()">
              <option value="">Todas las temporadas</option>
              @for (t of viajesTemporadas(); track t.id) {
                <option [value]="t.id">{{ t.label }}</option>
              }
            </select>
            <select class="cfl-select w-48 text-xs" [value]="viajesEmpresaId()" (change)="viajesEmpresaId.set($any($event.target).value); loadViajes()">
              <option value="">Todas las empresas</option>
              @for (e of viajesEmpresas(); track e.id) {
                <option [value]="e.id">{{ e.label }}</option>
              }
            </select>
            <button type="button" (click)="exportViajes()" [disabled]="viajesExporting()" class="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-xs font-medium text-forest-700 hover:bg-forest-50 transition disabled:opacity-50">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              {{ viajesExporting() ? 'Exportando...' : 'Excel' }}
            </button>
          </div>

          @if (viajesLoading()) {
            <div class="px-5 py-8 text-center text-sm text-forest-500">Cargando viajes...</div>
          } @else if (viajesRows().length === 0) {
            <div class="px-5 py-8 text-center text-sm text-forest-400">Sin datos para los filtros seleccionados.</div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="bg-forest-50 border-b border-forest-100">
                    <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Empresa</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Chofer</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">RUT Chofer</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Temporada</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Periodo</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Viajes</th>
                    <th class="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Monto Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-50">
                  @for (row of viajesRows(); track $index) {
                    <tr class="hover:bg-forest-50/50 transition-colors">
                      <td class="px-4 py-2 text-sm text-forest-900">{{ row.empresa_nombre || 'Sin asignar' }}</td>
                      <td class="px-4 py-2 text-sm text-forest-900">{{ row.chofer_nombre || 'Sin asignar' }}</td>
                      <td class="px-4 py-2 text-sm text-forest-500 font-mono text-xs">{{ row.chofer_rut || '-' }}</td>
                      <td class="px-4 py-2 text-sm text-forest-700">{{ row.temporada_codigo || '-' }}</td>
                      <td class="px-4 py-2 text-sm text-forest-700 font-mono">{{ row.periodo }}</td>
                      <td class="px-4 py-2 text-sm text-forest-900 text-right font-semibold">{{ row.total_viajes | number }}</td>
                      <td class="px-4 py-2 text-sm text-forest-900 text-right font-semibold">{{ clp(row.monto_total) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="bg-forest-50 border-t border-forest-200 font-bold">
                    <td colspan="5" class="px-4 py-2 text-sm text-forest-900">TOTAL</td>
                    <td class="px-4 py-2 text-sm text-forest-900 text-right">{{ viajesTotalViajes() | number }}</td>
                    <td class="px-4 py-2 text-sm text-forest-900 text-right">{{ clp(viajesTotalMonto()) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>

      }
    </app-workspace-shell>
  `
})
export class EstadisticasComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('timelineChart') timelineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sentidoChart') sentidoCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('transportistasChart') transportistasCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('centrosChart') centrosCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('productoresChart') productoresCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tiposFleteChart') tiposFleteCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('estadosChart') estadosCanvas!: ElementRef<HTMLCanvasElement>;

  readonly loading = signal(false);
  private data: DashboardData | null = null;
  private charts: Chart<any>[] = [];

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.loadData();
    this.loadViajes();
  }

  ngAfterViewInit(): void {}

  private loadData(): void {
    this.loading.set(true);
    this.cflApi.getEstadisticasOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data = res.data as DashboardData;
          this.loading.set(false);
          // Wait for Angular to render the @if block, then for the browser to layout the canvases
          requestAnimationFrame(() => requestAnimationFrame(() => this.buildCharts()));
        },
        error: () => {
          this.data = null;
          this.loading.set(false);
        },
      });
  }

  // --- Helpers ---
  n(key: string): number {
    const v = Number(this.data?.resumen?.[key]);
    return Number.isFinite(v) ? v : 0;
  }
  clp = formatCLP;

  // --- Chart builders ---
  private buildCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    if (!this.data) return;

    this.buildTimelineChart();
    this.buildSentidoChart();
    this.buildHorizontalBar(this.transportistasCanvas, this.data.transportistas, 'empresa_nombre', 'monto_total', CHART_COLORS.teal);
    this.buildHorizontalBar(this.centrosCanvas, this.data.centros_costo.map(c => ({ ...c, label: `${c.sap_codigo || ''} ${c.nombre || ''}`.trim() })), 'label', 'monto_total', CHART_COLORS.forest);
    this.buildHorizontalBar(this.productoresCanvas, this.data.productores.map(p => ({ ...p, label: `${p.codigo_proveedor || ''} ${p.nombre || ''}`.trim() })), 'label', 'monto_total', CHART_COLORS.amber);
    this.buildTiposFleteChart();
    this.buildEstadosChart();
  }

  private buildTimelineChart(): void {
    if (!this.timelineCanvas?.nativeElement || !this.data?.timeline?.length) return;
    const tl = this.data.timeline;
    const labels = tl.map(t => this.formatPeriodo(t.periodo));

    const chart = new Chart(this.timelineCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Monto Fletes',
            data: tl.map(t => t.monto_movimientos),
            backgroundColor: CHART_COLORS.teal + '99',
            borderColor: CHART_COLORS.teal,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
            order: 2,
          },
          {
            label: 'Monto Facturado',
            data: tl.map(t => t.monto_facturado),
            backgroundColor: CHART_COLORS.forest + '99',
            borderColor: CHART_COLORS.forest,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
            order: 3,
          },
          {
            label: 'N° Fletes',
            data: tl.map(t => t.total_fletes),
            type: 'line',
            borderColor: CHART_COLORS.amber,
            backgroundColor: CHART_COLORS.amber + '33',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: CHART_COLORS.amber,
            fill: false,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => {
            const v = ctx.parsed.y;
            return ctx.dataset.yAxisID === 'y1' ? `${ctx.dataset.label}: ${v}` : `${ctx.dataset.label}: ${formatCLP(v)}`;
          }}},
        },
        scales: {
          y: { position: 'left', ticks: { callback: (v) => this.shortCLP(Number(v)) }, grid: { color: '#f0f0f0' } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
          x: { grid: { display: false } },
        },
      },
    });
    this.charts.push(chart);
  }

  private buildSentidoChart(): void {
    if (!this.sentidoCanvas?.nativeElement || !this.data?.sentido?.length) return;
    const s = this.data.sentido;
    const chart = new Chart(this.sentidoCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: s.map(x => x.tipo),
        datasets: [{
          data: s.map(x => x.total),
          backgroundColor: [CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.slate],
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} fletes (${formatCLP(s[ctx.dataIndex]?.monto || 0)})` }},
        },
      },
    });
    this.charts.push(chart);
  }

  private buildHorizontalBar(canvasRef: ElementRef<HTMLCanvasElement> | undefined, items: Array<Record<string, unknown>>, labelKey: string, valueKey: string, color: string): void {
    if (!canvasRef?.nativeElement || !items?.length) return;
    const chart = new Chart(canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: items.map(i => this.truncate(String(i[labelKey] || '-'), 25)),
        datasets: [{
          data: items.map(i => Number(i[valueKey]) || 0),
          backgroundColor: color + 'cc',
          borderColor: color,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => formatCLP(ctx.parsed.x) }},
        },
        scales: {
          x: { ticks: { callback: (v) => this.shortCLP(Number(v)) }, grid: { color: '#f0f0f0' } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });
    this.charts.push(chart);
  }

  private buildTiposFleteChart(): void {
    if (!this.tiposFleteCanvas?.nativeElement || !this.data?.tipos_flete?.length) return;
    const tf = this.data.tipos_flete;
    const chart = new Chart(this.tiposFleteCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: tf.map(t => t.nombre || '-'),
        datasets: [{
          data: tf.map(t => t.monto_total),
          backgroundColor: PALETTE.slice(0, tf.length).map(c => c + 'cc'),
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCLP(ctx.parsed)}` }},
        },
      },
    });
    this.charts.push(chart);
  }

  private buildEstadosChart(): void {
    if (!this.estadosCanvas?.nativeElement || !this.data?.estados?.length) return;
    const e = this.data.estados;
    const stateColors: Record<string, string> = {
      DETECTADO: CHART_COLORS.slate,
      COMPLETADO: CHART_COLORS.forest,
      EN_REVISION: CHART_COLORS.amber,
      PREFACTURADO: CHART_COLORS.blue,
      FACTURADO: CHART_COLORS.teal,
      DESCARTADO: CHART_COLORS.red,
    };
    const chart = new Chart(this.estadosCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: e.map(s => s.estado),
        datasets: [
          {
            label: 'Cantidad',
            data: e.map(s => s.total),
            backgroundColor: e.map(s => (stateColors[s.estado] || CHART_COLORS.slate) + 'cc'),
            borderColor: e.map(s => stateColors[s.estado] || CHART_COLORS.slate),
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: 'Monto',
            data: e.map(s => s.monto),
            backgroundColor: e.map(s => (stateColors[s.estado] || CHART_COLORS.slate) + '44'),
            borderColor: e.map(s => (stateColors[s.estado] || CHART_COLORS.slate) + '99'),
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ctx.datasetIndex === 1 ? `Monto: ${formatCLP(ctx.parsed.y)}` : `Cantidad: ${ctx.parsed.y}` }},
        },
        scales: {
          y: { position: 'left', ticks: { precision: 0 }, grid: { color: '#f0f0f0' } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: (v) => this.shortCLP(Number(v)) } },
          x: { grid: { display: false } },
        },
      },
    });
    this.charts.push(chart);
  }

  // --- Utilities ---
  private formatPeriodo(p: string): string {
    if (!p || p.length < 7) return p || '';
    const [y, m] = p.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[parseInt(m, 10) - 1] || m} ${y}`;
  }

  private shortCLP(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  // ── Viajes por Chofer y Transportista ───────────────────────────────
  viajesRows = signal<any[]>([]);
  viajesLoading = signal(false);
  viajesExporting = signal(false);
  viajesTemporadaId = signal('');
  viajesEmpresaId = signal('');
  viajesTemporadas = signal<{ id: string; label: string }[]>([]);
  viajesEmpresas = signal<{ id: string; label: string }[]>([]);

  viajesTotalViajes = computed(() => this.viajesRows().reduce((s: number, r: any) => s + Number(r.total_viajes || 0), 0));
  viajesTotalMonto = computed(() => this.viajesRows().reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0));

  loadViajes(): void {
    this.viajesLoading.set(true);
    const params: Record<string, unknown> = {};
    if (this.viajesTemporadaId()) params['temporada_id'] = this.viajesTemporadaId();
    if (this.viajesEmpresaId()) params['empresa_id'] = this.viajesEmpresaId();

    this.cflApi.getEstadisticasViajes(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = res.data || [];
          this.viajesRows.set(rows);
          this.viajesLoading.set(false);
          this.extractViajesFilters(rows);
        },
        error: () => this.viajesLoading.set(false),
      });
  }

  private extractViajesFilters(rows: any[]): void {
    const temps = new Map<string, string>();
    const emps = new Map<string, string>();
    for (const r of rows) {
      if (r.id_temporada) temps.set(String(r.id_temporada), r.temporada_codigo || r.temporada_nombre || String(r.id_temporada));
      if (r.id_empresa) emps.set(String(r.id_empresa), r.empresa_nombre || String(r.id_empresa));
    }
    if (this.viajesTemporadas().length === 0) {
      this.viajesTemporadas.set([...temps.entries()].map(([id, label]) => ({ id, label })));
    }
    if (this.viajesEmpresas().length === 0) {
      this.viajesEmpresas.set([...emps.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)));
    }
  }

  exportViajes(): void {
    this.viajesExporting.set(true);
    const params: Record<string, unknown> = {};
    if (this.viajesTemporadaId()) params['temporada_id'] = this.viajesTemporadaId();
    if (this.viajesEmpresaId()) params['empresa_id'] = this.viajesEmpresaId();

    this.cflApi.exportEstadisticasViajes(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.viajesExporting.set(false);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `estadisticas-viajes-${new Date().toISOString().slice(0, 10)}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.viajesExporting.set(false),
      });
  }
}
