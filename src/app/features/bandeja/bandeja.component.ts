import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import {
  adaptCandidato,
  adaptFleteEnCurso,
  CandidatoRow,
  ESTADO_BADGE,
  ESTADO_DOT,
  ESTADO_HINT,
  ESTADO_LABELS,
  FleteEnCursoRow,
  FleteTabla,
  LifecycleStatus,
} from '../../core/models/flete.model';
import { AuthService } from '../../core/services/auth.service';
import { CflApiService } from '../../core/services/cfl-api.service';
import { EditFleteModalComponent } from './edit-flete-modal.component';

@Component({
  selector: 'app-bandeja',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, EditFleteModalComponent],
  templateUrl: './bandeja.component.html',
})
export class BandejaComponent implements OnInit {
  /* ── User session ─────────────────────────────── */
  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? (u.nombre ? `${u.nombre} ${u.apellido ?? ''}`.trim() : u.username) : 'Usuario';
  }
  get userRole(): string { return this.auth.getCurrentUser()?.role ?? ''; }
  get roleLabel(): string {
    const map: Record<string, string> = {
      ingresador:    'Ingresador',
      autorizador:   'Autorizador',
      administrador: 'Administrador',
    };
    return map[this.userRole] ?? this.userRole;
  }
  get userInitials(): string {
    return this.userName.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  }

  /* ── Tabs ─────────────────────────────────────── */
  activeTab = signal<'candidatos' | 'en_curso'>('candidatos');

  /* ── Data ─────────────────────────────────────── */
  allFletes         = signal<FleteTabla[]>([]);
  loading           = signal(false);
  showUserMenu      = signal(false);
  mobileSidebarOpen = signal(false);

  /* ── Toast ────────────────────────────────────── */
  toastMsg      = signal('');
  toastIsError  = signal(false);
  private _toastTimer?: ReturnType<typeof setTimeout>;

  /* ── Modal edición ────────────────────────────── */
  editModalFlete   = signal<FleteTabla | null>(null);
  editModalVisible = signal(false);

  /* ── Selección para folio ─────────────────────── */
  selectedIds = signal<Set<string>>(new Set());

  /* ── Paginación server-side ───────────────────── */
  currentPage      = signal(1);
  itemsPerPage     = signal(25);
  totalServerItems = signal(0);
  serverTotalPages = signal(0);

  /* ── Filtros ──────────────────────────────────── */
  guiaFilter   = signal('');
  estadoFilter = signal<LifecycleStatus | 'all'>('all');

  /* ── Computed ─────────────────────────────────── */
  paginatedFletes = computed(() => this.allFletes());

  totalPages = computed(() => this.serverTotalPages() || 1);
  totalItems = computed(() => this.totalServerItems());

  canAsignarFolioComputed = computed(() => {
    if (!this.canAssignFolio()) return false;
    const sel = this.selectedIds();
    return sel.size > 0;
  });

  pageNumbers = computed(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  /* ── Opciones estáticas ──────────────────────── */
  estadoOptions: { value: LifecycleStatus | 'all'; label: string }[] = [
    { value: 'all',            label: 'Todos los estados' },
    { value: 'DETECTADO',      label: 'Detectado' },
    { value: 'ACTUALIZADO',    label: 'Actualizado' },
    { value: 'EN_REVISION',    label: 'En revisión' },
    { value: 'COMPLETADO',     label: 'Completado' },
    { value: 'ASIGNADO_FOLIO', label: 'Asignado folio' },
    { value: 'FACTURADO',      label: 'Facturado' },
    { value: 'ANULADO',        label: 'Anulado' },
  ];
  itemsPerPageOptions = [10, 25, 50, 100];

  /* ── Helpers de template ─────────────────────── */
  readonly ESTADO_LABELS = ESTADO_LABELS;
  readonly ESTADO_BADGE  = ESTADO_BADGE;
  readonly ESTADO_DOT    = ESTADO_DOT;
  readonly ESTADO_HINT   = ESTADO_HINT;

  constructor(
    private auth:   AuthService,
    private cflApi: CflApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFletes();
  }

  /* ── Carga de datos ──────────────────────────── */
  loadFletes(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());

    const page      = this.currentPage();
    const page_size = this.itemsPerPage();
    const search    = this.guiaFilter().trim() || undefined;
    const estado    = this.estadoFilter() !== 'all' ? this.estadoFilter() : undefined;

    if (this.activeTab() === 'candidatos') {
      this.cflApi.getMissingFletes({ page, page_size, search }).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as CandidatoRow[]).map(adaptCandidato));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this._showToast(err?.error?.error ?? 'Error cargando candidatos SAP', true);
          this.loading.set(false);
        },
      });
    } else {
      this.cflApi.getCompletosSinFolio({ page, page_size, estado }).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as FleteEnCursoRow[]).map(adaptFleteEnCurso));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this._showToast(err?.error?.error ?? 'Error cargando fletes en curso', true);
          this.loading.set(false);
        },
      });
    }
  }

  /* ── Tabs ────────────────────────────────────── */
  setTab(tab: 'candidatos' | 'en_curso'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.guiaFilter.set('');
    this.estadoFilter.set('all');
    this.loadFletes();
  }

  /* ── Filtros ─────────────────────────────────── */
  applyFilters(): void {
    this.currentPage.set(1);
    this.loadFletes();
  }

  clearFilters(): void {
    this.guiaFilter.set('');
    this.estadoFilter.set('all');
    this.currentPage.set(1);
    this.loadFletes();
  }

  hasActiveFilters(): boolean {
    return this.guiaFilter() !== '' || this.estadoFilter() !== 'all';
  }

  /* ── Paginación ──────────────────────────────── */
  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadFletes();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadFletes();
    }
  }

  goToPage(p: number | '...'): void {
    if (typeof p === 'number' && p !== this.currentPage()) {
      this.currentPage.set(p);
      this.loadFletes();
    }
  }

  onItemsPerPageChange(value: string): void {
    this.itemsPerPage.set(Number(value));
    this.currentPage.set(1);
    this.loadFletes();
  }

  paginationEnd(): number {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems());
  }

  /* ── Selección para folio ─────────────────────── */
  toggleSelect(id: string): void {
    const s = new Set(this.selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selectedIds.set(s);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  selectAllVisible(): void {
    const seleccionables = this.paginatedFletes()
      .filter(f => f.kind === 'en_curso' && f.estado === 'COMPLETADO')
      .map(f => f.id);
    const s = new Set(this.selectedIds());
    seleccionables.forEach(id => s.add(id));
    this.selectedIds.set(s);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /* ── Acciones de flete ───────────────────────── */
  ingresarFlete(flete: FleteTabla): void {
    if (!flete.idSapEntrega) return;
    this.cflApi.ingresarFletePendiente(flete.idSapEntrega).subscribe({
      next: () => {
        this._showToast('Flete ingresado correctamente');
        this.loadFletes();
      },
      error: (err) => this._showToast(err?.error?.error ?? 'Error al ingresar flete', true),
    });
  }

  anularFlete(flete: FleteTabla): void {
    if (!flete.idCabeceraFlete) return;
    this.cflApi.anularFlete(flete.idCabeceraFlete).subscribe({
      next: () => {
        this._showToast('Flete anulado');
        this.loadFletes();
      },
      error: (err) => this._showToast(err?.error?.error ?? 'Error al anular flete', true),
    });
  }

  /* ── Modal edición ────────────────────────────── */
  openEditModal(flete: FleteTabla | null): void {
    this.editModalFlete.set(flete);
    this.editModalVisible.set(true);
  }

  onEditGuardado(): void {
    this.editModalVisible.set(false);
    this._showToast('Flete guardado correctamente');
    this.loadFletes();
  }

  onEditCerrado(): void {
    this.editModalVisible.set(false);
  }

  /* ── Asignación de folio ──────────────────────── */
  asignarFolioSeleccionados(): void {
    const ids = [...this.selectedIds()]
      .filter(id => id.startsWith('cab-'))
      .map(id => Number(id.replace('cab-', '')));

    if (ids.length === 0) return;

    this.cflApi.asignarNuevoFolio({ ids_cabecera_flete: ids }).subscribe({
      next: (res) => {
        this._showToast(`Folio ${res.data?.folio_numero ?? ''} creado y asignado`);
        this.selectedIds.set(new Set());
        this.loadFletes();
      },
      error: (err) => this._showToast(err?.error?.error ?? 'Error asignando folio', true),
    });
  }

  /* ── Auth ─────────────────────────────────────── */
  logout(): void {
    this.auth.logout();
  }

  /* ── Role checks ─────────────────────────────── */
  canAssignFolio(): boolean {
    return ['autorizador', 'administrador'].includes(this.userRole);
  }

  canAnular(): boolean {
    return ['autorizador', 'administrador'].includes(this.userRole);
  }

  /* ── Formatting ──────────────────────────────── */
  formatMonto(monto: number): string {
    return new Intl.NumberFormat('es-CL', {
      style:    'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto);
  }

  trackByFlete(_: number, f: FleteTabla): string {
    return f.id;
  }

  /* ── Toast ────────────────────────────────────── */
  private _showToast(msg: string, isError = false): void {
    clearTimeout(this._toastTimer);
    this.toastMsg.set(msg);
    this.toastIsError.set(isError);
    this._toastTimer = setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
