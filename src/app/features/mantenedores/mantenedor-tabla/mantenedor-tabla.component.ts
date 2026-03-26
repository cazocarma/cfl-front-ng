import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate as formatDateFn } from '../../../core/utils/format.utils';
import { AuthnService } from '../../../core/services/authn.service';
import { MantenedorConfig, MANTENEDORES_MAP } from '../mantenedor.config';
import { MantenedorFormModalComponent } from '../mantenedor-form/mantenedor-form-modal.component';

@Component({
    selector: 'app-mantenedor-tabla',
    imports: [
        SlicePipe,
        FormsModule,
        MantenedorFormModalComponent,
    ],
    host: { class: 'flex flex-1 flex-col overflow-hidden' },
    templateUrl: './mantenedor-tabla.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MantenedorTablaComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  /* ── Config de entidad ─────────────────────────────────────── */
  config = signal<MantenedorConfig | null>(null);

  /* ── Datos ─────────────────────────────────────────────────── */
  allRows    = signal<Record<string, unknown>[]>([]);
  loading    = signal(false);
  canEdit    = signal(false);

  private toast = inject(ToastService);

  /* ── Filtros y paginación (client-side) ────────────────────── */
  searchText    = signal('');
  activoFilter  = signal<'si' | 'no' | 'todos'>('si');
  currentPage   = signal(1);
  itemsPerPage  = signal(25);
  readonly itemsPerPageOptions = [10, 25, 50];

  /* ── Tarifas: filtro por temporada ─────────────────────────── */
  temporadas         = signal<Record<string, unknown>[]>([]);
  selectedTemporadaId = signal<number | null>(null);

  /* ── Computed ──────────────────────────────────────────────── */
  filteredRows = computed(() => {
    const q = this.searchText().toLowerCase().trim();
    if (!q) return this.allRows();
    return this.allRows().filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / this.itemsPerPage())));

  paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    return this.filteredRows().slice(start, start + this.itemsPerPage());
  });

  pageNumbers = computed(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  /* ── Modales ───────────────────────────────────────────────── */
  formModalVisible  = signal(false);
  formModalRow      = signal<Record<string, unknown> | null>(null);

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private api:    CflApiService,
    public  auth:   AuthnService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const entity = params.get('entity') ?? '';
      const cfg = MANTENEDORES_MAP.get(entity) ?? null;
      this.config.set(cfg);

      if (!cfg) {
        this.router.navigate(['/mantenedores']);
        return;
      }

      const shouldOpenRutaModal = cfg.key === 'rutas' && this.route.snapshot.queryParamMap.get('nueva') === '1';
      if (shouldOpenRutaModal) {
        this.openCreate();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { nueva: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }

      if (cfg.tipoEspecial === 'tarifas') {
        this._loadTemporadas();
      } else {
        this._loadRows();
      }
    });
  }

  /* ── Carga de datos ───────────────────────────────────────── */
  private _loadTemporadas(): void {
    this.api.getTemporadaActiva().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        const activa = res.data;
        this.api.listMaintainerRows('temporadas').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (t: any) => {
            const rows = this._normalizeRows((t.data as Record<string, unknown>[]) ?? []);
            this.temporadas.set(rows);
            const activaId = Number(activa?.id_temporada ?? activa?.IdTemporada ?? 0);
            if (activaId > 0) {
              this.selectedTemporadaId.set(activaId);
            }
            this._loadTarifas();
          },
          error: () => this._loadTarifas(),
        });
      },
      error: () => {
        this.api.listMaintainerRows('temporadas').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (t: any) => {
            this.temporadas.set(this._normalizeRows((t.data as Record<string, unknown>[]) ?? []));
            this._loadTarifas();
          },
          error: () => this._loadTarifas(),
        });
      },
    });
  }

  private _loadTarifas(): void {
    this.loading.set(true);
    const tempId = this.selectedTemporadaId();
    const params: Record<string, unknown> = { activo: this.activoFilter() };
    if (tempId) params['temporada_id'] = tempId;

    this.api.listMaintainerRows('tarifas', params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.allRows.set(this._normalizeRows((res.data as Record<string, unknown>[]) ?? []));
        this.canEdit.set(res.permissions?.can_edit ?? false);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => {
        this.toast.show(err?.error?.error ?? 'Error cargando tarifas', true);
        this.loading.set(false);
      },
    });
  }

  _loadRows(): void {
    const cfg = this.config();
    if (!cfg) return;

    this.loading.set(true);
    const params: Record<string, unknown> = { activo: this.activoFilter() };
    this.api.listMaintainerRows(cfg.key, params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.allRows.set(this._normalizeRows((res.data as Record<string, unknown>[]) ?? []));
        this.canEdit.set(res.permissions?.can_edit ?? false);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => {
        this.toast.show(err?.error?.error ?? `Error cargando ${cfg.title}`, true);
        this.loading.set(false);
      },
    });
  }

  onTemporadaChange(id: string): void {
    this.selectedTemporadaId.set(id ? Number(id) : null);
    this._loadTarifas();
  }

  /* ── Acciones de tabla ────────────────────────────────────── */
  openCreate(): void {
    this.formModalRow.set(null);
    this.formModalVisible.set(true);
  }

  openEdit(row: Record<string, unknown>): void {
    const cfg = this.config();
    if (!cfg) return;

    this.formModalRow.set(row);
    this.formModalVisible.set(true);
  }

  toggleActivo(row: Record<string, unknown>): void {
    const cfg = this.config();
    if (!cfg || !cfg.softDeleteField) return;

    const id = Number(row[cfg.idField]);
    const current = Boolean(row[cfg.softDeleteField]);
    const nuevoValor = !current;

    this.api.toggleMaintainerActivo(cfg.key, id, nuevoValor, cfg.softDeleteField).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.show(`${cfg.title} ${nuevoValor ? 'activado' : 'desactivado'}`);
        this._reloadAfterAction();
      },
      error: (err) => this.toast.show(err?.error?.error ?? 'Error al cambiar estado', true),
    });
  }

  onFormGuardado(): void {
    this.formModalVisible.set(false);
    this.toast.show('Registro guardado correctamente');
    this._reloadAfterAction();
  }

  onFormCerrado(): void { this.formModalVisible.set(false); }

  private _reloadAfterAction(): void {
    const cfg = this.config();
    if (!cfg) return;
    if (cfg.tipoEspecial === 'tarifas') this._loadTarifas();
    else this._loadRows();
  }

  /* ── Formateo de celdas ───────────────────────────────────── */
  formatCell(value: unknown, tipo?: string): string {
    if (value === null || value === undefined || value === '') return '—';
    if (tipo === 'date') {
      return formatDateFn(value);
    }
    if (tipo === 'currency') {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value));
    }
    return String(value);
  }

  isBool(value: unknown): boolean { return typeof value === 'boolean' || value === 0 || value === 1; }
  asBool(value: unknown): boolean { return Boolean(value); }

  getBadgeClass(value: unknown, badgeMap?: Record<string, string>): string {
    if (!badgeMap) return 'badge bg-slate-100 text-slate-600 border-slate-200';
    return badgeMap[String(value ?? '')] ?? 'badge bg-slate-100 text-slate-600 border-slate-200';
  }

  /* ── Paginación ───────────────────────────────────────────── */
  prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage(): void { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }
  goToPage(p: number | '...'): void { if (typeof p === 'number') this.currentPage.set(p); }
  onItemsChange(val: string): void { this.itemsPerPage.set(Number(val)); this.currentPage.set(1); }

  onSearch(): void { this.currentPage.set(1); }

  onActivoFilterChange(val: string): void {
    this.activoFilter.set(val as 'si' | 'no' | 'todos');
    this.currentPage.set(1);
    if (this.config()?.tipoEspecial === 'tarifas') {
      this._loadTarifas();
    } else {
      this._loadRows();
    }
  }

  paginationStart(): number { return (this.currentPage() - 1) * this.itemsPerPage() + 1; }
  paginationEnd(): number { return Math.min(this.currentPage() * this.itemsPerPage(), this.filteredRows().length); }

  /* ── Navigation ────────────────────────────────────────────── */
  goBack(): void { this.router.navigate(['/mantenedores']); }

  /* ── Role checks ───────────────────────────────────────────── */
  get userRole(): string { return this.auth.getCurrentUser()?.role ?? ''; }
  get isAdminOrAutorizador(): boolean { return ['administrador', 'autorizador'].includes(this.userRole); }


  private _normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => this._normalizeRow(row));
  }

  private _normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...row };
    for (const [key, value] of Object.entries(row)) {
      const snake = this._toSnakeKey(key);
      if (!Object.prototype.hasOwnProperty.call(normalized, snake)) {
        normalized[snake] = value;
      }
    }
    return normalized;
  }

  private _toSnakeKey(key: string): string {
    return String(key)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s\-]+/g, '_')
      .toLowerCase();
  }

  trackByIndex(i: number): number { return i; }
}
