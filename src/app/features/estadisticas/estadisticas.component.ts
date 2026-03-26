import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
}
