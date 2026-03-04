import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { CflApiService } from '../../../core/services/cfl-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { MantenedorConfig, MANTENEDORES_MAP } from '../mantenedor.config';
import { MantenedorFormModalComponent } from '../mantenedor-form/mantenedor-form-modal.component';
import { UsuarioFormModalComponent } from '../usuarios/usuario-form-modal.component';
import { FolioDetalleModalComponent } from '../folios/folio-detalle-modal.component';

@Component({
  selector: 'app-mantenedor-tabla',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MantenedorFormModalComponent,
    UsuarioFormModalComponent,
    FolioDetalleModalComponent,
  ],
  host: { class: 'flex flex-1 flex-col overflow-hidden' },
  templateUrl: './mantenedor-tabla.component.html',
})
export class MantenedorTablaComponent implements OnInit {
  /* ── Config de entidad ─────────────────────────────────────── */
  config = signal<MantenedorConfig | null>(null);

  /* ── Datos ─────────────────────────────────────────────────── */
  allRows    = signal<Record<string, unknown>[]>([]);
  loading    = signal(false);
  canEdit    = signal(false);

  /* ── Toast ─────────────────────────────────────────────────── */
  toastMsg     = signal('');
  toastIsError = signal(false);
  private _toastTimer?: ReturnType<typeof setTimeout>;

  /* ── Filtros y paginación (client-side) ────────────────────── */
  searchText   = signal('');
  currentPage  = signal(1);
  itemsPerPage = signal(25);
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

  folioModalVisible = signal(false);
  folioModalRow     = signal<Record<string, unknown> | null>(null);
  folioToggleLoadingId = signal<number | null>(null);

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private api:    CflApiService,
    public  auth:   AuthService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const entity = params.get('entity') ?? '';
      const cfg = MANTENEDORES_MAP.get(entity) ?? null;
      this.config.set(cfg);

      if (!cfg) {
        this.router.navigate(['/mantenedores']);
        return;
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
    this.api.getTemporadaActiva().subscribe({
      next: (res: any) => {
        const activa = res.data;
        this.api.listMaintainerRows('temporadas').subscribe({
          next: (t: any) => {
            this.temporadas.set(t.data as Record<string, unknown>[]);
            if (activa?.id_temporada) {
              this.selectedTemporadaId.set(Number(activa.id_temporada));
            }
            this._loadTarifas();
          },
          error: () => this._loadTarifas(),
        });
      },
      error: () => {
        this.api.listMaintainerRows('temporadas').subscribe({
          next: (t: any) => { this.temporadas.set(t.data as Record<string, unknown>[]); this._loadTarifas(); },
          error: () => this._loadTarifas(),
        });
      },
    });
  }

  private _loadTarifas(): void {
    this.loading.set(true);
    const tempId = this.selectedTemporadaId() ?? undefined;
    this.api.listTarifas(tempId).subscribe({
      next: (res) => {
        this.allRows.set(res.data as Record<string, unknown>[]);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => {
        this._showToast(err?.error?.error ?? 'Error cargando tarifas', true);
        this.loading.set(false);
      },
    });
  }

  _loadRows(): void {
    const cfg = this.config();
    if (!cfg) return;

    this.loading.set(true);
    this.api.listMaintainerRows(cfg.key).subscribe({
      next: (res: any) => {
        this.allRows.set(res.data as Record<string, unknown>[]);
        this.canEdit.set(res.permissions?.can_edit ?? false);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => {
        this._showToast(err?.error?.error ?? `Error cargando ${cfg.title}`, true);
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

    if (cfg.tipoEspecial === 'folios') {
      this.folioModalRow.set(row);
      this.folioModalVisible.set(true);
      return;
    }

    this.formModalRow.set(row);
    this.formModalVisible.set(true);
  }

  toggleActivo(row: Record<string, unknown>): void {
    const cfg = this.config();
    if (!cfg || !cfg.softDeleteField) return;

    const id = Number(row[cfg.idField]);
    const current = Boolean(row[cfg.softDeleteField]);
    const nuevoValor = !current;

    this.api.toggleMaintainerActivo(cfg.key, id, nuevoValor).subscribe({
      next: () => {
        this._showToast(`${cfg.title} ${nuevoValor ? 'activado' : 'desactivado'}`);
        this._reloadAfterAction();
      },
      error: (err) => this._showToast(err?.error?.error ?? 'Error al cambiar estado', true),
    });
  }

  onFormGuardado(): void {
    this.formModalVisible.set(false);
    this._showToast('Registro guardado correctamente');
    this._reloadAfterAction();
  }

  onFormCerrado(): void { this.formModalVisible.set(false); }

  onFolioGuardado(): void {
    this.folioModalVisible.set(false);
    this._showToast('Folio actualizado');
    this._reloadAfterAction();
  }

  onFolioCerrado(): void { this.folioModalVisible.set(false); }

  isFolioBlocked(row: Record<string, unknown>): boolean {
    const value = row['bloqueado'];
    return value === true || value === 1;
  }

  canToggleFolioBloqueo(row: Record<string, unknown>): boolean {
    const cfg = this.config();
    if (!cfg || cfg.tipoEspecial !== 'folios') return false;
    const folioNumero = String(row['folio_numero'] ?? '').trim();
    return folioNumero !== '0';
  }

  toggleFolioBloqueo(row: Record<string, unknown>): void {
    const cfg = this.config();
    if (!cfg || cfg.tipoEspecial !== 'folios') return;

    const idFolio = Number(row['id_folio']);
    if (!Number.isInteger(idFolio) || idFolio <= 0) return;

    const nuevoBloqueado = !this.isFolioBlocked(row);
    this.folioToggleLoadingId.set(idFolio);

    this.api.toggleFolioBloqueo(idFolio, nuevoBloqueado).subscribe({
      next: () => {
        this.folioToggleLoadingId.set(null);
        this._showToast(`Folio ${nuevoBloqueado ? 'bloqueado' : 'desbloqueado'}`);
        this._reloadAfterAction();
      },
      error: (err) => {
        this.folioToggleLoadingId.set(null);
        this._showToast(err?.error?.error ?? 'Error al cambiar bloqueo del folio', true);
      },
    });
  }

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
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
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

  paginationStart(): number { return (this.currentPage() - 1) * this.itemsPerPage() + 1; }
  paginationEnd(): number { return Math.min(this.currentPage() * this.itemsPerPage(), this.filteredRows().length); }

  /* ── Navigation ────────────────────────────────────────────── */
  goBack(): void { this.router.navigate(['/mantenedores']); }

  /* ── Role checks ───────────────────────────────────────────── */
  get userRole(): string { return this.auth.getCurrentUser()?.role ?? ''; }
  get isAdminOrAutorizador(): boolean { return ['administrador', 'autorizador'].includes(this.userRole); }

  /* ── Toast ─────────────────────────────────────────────────── */
  private _showToast(msg: string, isError = false): void {
    clearTimeout(this._toastTimer);
    this.toastMsg.set(msg);
    this.toastIsError.set(isError);
    this._toastTimer = setTimeout(() => this.toastMsg.set(''), 4000);
  }

  trackByIndex(i: number): number { return i; }
}
