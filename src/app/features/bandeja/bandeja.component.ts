import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';

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
import { AuthnService } from '../../core/services/authn.service';
import { AuthzService } from '../../core/services/authz.service';
import { CflApiService } from '../../core/services/cfl-api.service';
import { Perms } from '../../core/config/permissions';
import { ToastService } from '../../core/services/toast.service';
import { EditFleteModalComponent, ModalMode } from './edit-flete-modal/edit-flete-modal.component';
import { DisabledIfNoPermissionDirective } from '../../core/directives/disabled-if-no-permission.directive';
import { AppSidebarComponent } from '../../core/components/app-sidebar/app-sidebar.component';

type ConfirmActionType = 'descartar' | 'anular';

@Component({
    selector: 'app-bandeja',
    standalone: true,
    imports: [FormsModule, EditFleteModalComponent, DisabledIfNoPermissionDirective, AppSidebarComponent],
    templateUrl: './bandeja.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BandejaComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private authz = inject(AuthzService);

  /*  Tabs  */
  activeTab = signal<'candidatos' | 'en_curso'>('en_curso');

  /*  Data  */
  allFletes = signal<FleteTabla[]>([]);
  loading = signal(false);
  mobileSidebarOpen = signal(false);

  private toast = inject(ToastService);
  /*  Modal edición / vista  */
  editModalFlete = signal<FleteTabla | null>(null);
  editModalVisible = signal(false);
  editModalMode = signal<ModalMode>('edit');

  /*  Vaciar bandeja  */
  vaciandoBandeja = signal(false);
  confirmarVaciarVisible = signal(false);

  /*  Confirmación descartar/anular  */
  confirmActionVisible = signal(false);
  confirmActionType = signal<ConfirmActionType | null>(null);
  confirmActionFlete = signal<FleteTabla | null>(null);
  confirmActionMotivo = signal('');
  confirmActionSaving = signal(false);

  /*  Selección  */
  selectedIds = signal<Set<string>>(new Set());

  /*  Paginación server-side  */
  currentPage = signal(1);
  itemsPerPage = signal(25);
  totalServerItems = signal(0);
  serverTotalPages = signal(0);

  /*  Filtros  */
  searchFilter = signal('');
  estadoFilter = signal<string>('PENDIENTES');
  fechaFilterValue = signal('all'); // 'all' | 'YYYY-MM' | 'rango'
  fechaDesdeFilter = signal('');
  fechaHastaFilter = signal('');

  private searchDebounce$ = new Subject<string>();

  /*  Ordenamiento  */
  sortBy = signal<string>('id');
  sortDir = signal<'asc' | 'desc'>('desc');

  /*  Computed  */
  paginatedFletes = computed(() => this.allFletes());

  totalPages = computed(() => this.serverTotalPages() || 1);
  totalItems = computed(() => this.totalServerItems());

  pageNumbers = computed(() => {
    const total = this.totalPages();
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

  /*  Opciones de periodo (mes actual + 5 anteriores, dinámico)  */
  readonly periodoOptions: { value: string; label: string }[] = (() => {
    const now = new Date();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
      return { value, label };
    });
  })();

  /*  Opciones estáticas  */
  estadoOptions: { value: string; label: string }[] = [
    { value: 'PENDIENTES', label: 'Pendientes' },
    { value: 'EN_REVISION', label: 'En revision' },
    { value: 'COMPLETADO', label: 'Completado' },
    { value: 'PREFACTURADO', label: 'Pre facturado' },
    { value: 'FACTURADO', label: 'Facturado' },
    { value: 'ANULADO', label: 'Anulado' },
    { value: 'all', label: 'Todos' },
  ];
  itemsPerPageOptions = [10, 25, 50, 100];

  /*  Helpers de template  */
  readonly ESTADO_LABELS = ESTADO_LABELS;
  readonly ESTADO_BADGE = ESTADO_BADGE;
  readonly ESTADO_DOT = ESTADO_DOT;
  readonly ESTADO_HINT = ESTADO_HINT;

  constructor(
    private auth: AuthnService,
    private cflApi: CflApiService,
  ) {}

  ngOnInit(): void {
    this.loadFletes();
    this.searchDebounce$.pipe(
      debounceTime(800),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.applyFilters());
  }

  ngOnDestroy(): void {}

  /*  Carga de datos  */
  loadFletes(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());

    const page = this.currentPage();
    const page_size = this.itemsPerPage();
    const search = this.searchFilter().trim() || undefined;
    const estadoRaw = this.estadoFilter();
    const estado = estadoRaw === 'PENDIENTES' ? 'PENDIENTES' : estadoRaw === 'all' ? 'TODOS' : estadoRaw || undefined;

    let fecha_desde: string | undefined;
    let fecha_hasta: string | undefined;
    const fv = this.fechaFilterValue();
    if (fv !== 'all' && fv !== 'rango') {
      const [year, month] = fv.split('-').map(Number);
      fecha_desde = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      fecha_hasta = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (fv === 'rango') {
      fecha_desde = this.fechaDesdeFilter() || undefined;
      fecha_hasta = this.fechaHastaFilter() || undefined;
    }

    const sort_by = this.sortBy();
    const sort_dir = this.sortDir();

    if (this.activeTab() === 'candidatos') {
      this.cflApi.getMissingFletes({ page, page_size, search, fecha_desde, fecha_hasta }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as CandidatoRow[]).map(adaptCandidato));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          if (this._handleAuthorizationError(err)) return;
          this.toast.show(err?.error?.error ?? 'No se pudieron cargar los candidatos. Intenta nuevamente.', true);
        },
      });
    } else {
      this.cflApi.getCompletados({ page, page_size, search, estado, fecha_desde, fecha_hasta, sort_by, sort_dir }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as FleteEnCursoRow[]).map(adaptFleteEnCurso));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          if (this._handleAuthorizationError(err)) return;
          this.toast.show(err?.error?.error ?? 'No se pudieron cargar los fletes. Intenta nuevamente.', true);
        },
      });
    }
  }

  /*  Tabs  */
  setTab(tab: 'candidatos' | 'en_curso'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.searchFilter.set('');
    this.estadoFilter.set(tab === 'en_curso' ? 'PENDIENTES' : 'all');
    this.fechaFilterValue.set('all');
    this.fechaDesdeFilter.set('');
    this.fechaHastaFilter.set('');
    this.sortBy.set('id');
    this.sortDir.set('desc');
    this.loadFletes();
  }

  /*  Ordenamiento  */
  toggleSort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('desc');
    }
    this.currentPage.set(1);
    this.loadFletes();
  }

  /*  Filtros  */
  onSearchInput(value: string): void {
    this.searchFilter.set(value);
    this.searchDebounce$.next(value);
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadFletes();
  }

  clearFilters(): void {
    this.searchFilter.set('');
    this.estadoFilter.set(this.activeTab() === 'en_curso' ? 'PENDIENTES' : 'all');
    this.fechaFilterValue.set('all');
    this.fechaDesdeFilter.set('');
    this.fechaHastaFilter.set('');
    this.currentPage.set(1);
    this.loadFletes();
  }

  hasActiveFilters(): boolean {
    if (this.searchFilter() !== '') return true;
    const defaultEstado = this.activeTab() === 'en_curso' ? 'PENDIENTES' : 'all';
    if (this.estadoFilter() !== defaultEstado) return true;
    const fv = this.fechaFilterValue();
    if (fv !== 'all' && fv !== 'rango') return true;
    if (fv === 'rango' && (this.fechaDesdeFilter() || this.fechaHastaFilter())) return true;
    return false;
  }

  onFechaFilterChange(value: string): void {
    this.fechaFilterValue.set(value);
    if (value !== 'rango') {
      this.fechaDesdeFilter.set('');
      this.fechaHastaFilter.set('');
      this.currentPage.set(1);
      this.loadFletes();
    }
  }

  onFechaRangoChange(): void {
    this.currentPage.set(1);
    this.loadFletes();
  }

  /*  Paginación  */
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

  /*  Selección  */
  toggleSelect(id: string): void {
    const s = new Set(this.selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.selectedIds.set(s);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /*  Acciones de flete  */
  openViewModal(flete: FleteTabla): void {
    if (!this.canViewFlete()) {
      this._showActionBlockedToast();
      return;
    }

    this.editModalMode.set('view');
    this.editModalFlete.set(flete);
    this.editModalVisible.set(true);
  }

  openClonarModal(flete: FleteTabla): void {
    this.editModalMode.set('clonar');
    this.editModalFlete.set(flete);
    this.editModalVisible.set(true);
  }

  openEditModal(flete: FleteTabla | null): void {
    if (!this.canEditForFlete(flete)) {
      this._showActionBlockedToast();
      return;
    }

    this.editModalMode.set('edit');
    this.editModalFlete.set(flete);
    this.editModalVisible.set(true);
  }

  openConfirmAction(action: ConfirmActionType, flete: FleteTabla): void {
    if (action === 'descartar' && !this.canDescartar()) {
      this._showActionBlockedToast();
      return;
    }

    if (action === 'anular' && !this.canAnularFlete(flete)) {
      this._showActionBlockedToast();
      return;
    }

    this.confirmActionType.set(action);
    this.confirmActionFlete.set(flete);
    this.confirmActionMotivo.set('');
    this.confirmActionSaving.set(false);
    this.confirmActionVisible.set(true);
  }

  closeConfirmAction(): void {
    if (this.confirmActionSaving()) return;
    this.confirmActionVisible.set(false);
    this.confirmActionType.set(null);
    this.confirmActionFlete.set(null);
    this.confirmActionMotivo.set('');
  }

  confirmActionTitle(): string {
    return this.confirmActionType() === 'anular' ? 'Confirmar anulación' : 'Confirmar descarte';
  }

  confirmActionSubmitLabel(): string {
    if (this.confirmActionSaving()) {
      return this.confirmActionType() === 'anular' ? 'Anulando...' : 'Descartando...';
    }
    return this.confirmActionType() === 'anular' ? 'Anular flete' : 'Descartar ingreso SAP';
  }

  confirmActionDescription(): string {
    const flete = this.confirmActionFlete();
    const guia = flete?.numeroGuia || '-';
    if (this.confirmActionType() === 'anular') {
      return `Se anulará el flete ${guia}. Ingresa un motivo para continuar.`;
    }
    return `Se descartará la entrega SAP ${guia}. Ingresa un motivo para continuar.`;
  }

  confirmActionPlaceholder(): string {
    return this.confirmActionType() === 'anular'
      ? 'Motivo de anulación'
      : 'Motivo de descarte';
  }

  onConfirmMotivoChange(value: string): void {
    this.confirmActionMotivo.set(value);
  }

  ejecutarConfirmacionAccion(): void {
    const action = this.confirmActionType();
    const flete = this.confirmActionFlete();
    if (!action || !flete) return;

    const motivo = this.confirmActionMotivo().trim();
    if (!motivo) {
      this.toast.show('Escribe un motivo antes de continuar.', true);
      return;
    }

    this.confirmActionSaving.set(true);

    if (action === 'descartar') {
      if (!flete.idSapEntrega) {
        this.confirmActionSaving.set(false);
        return;
      }

      const isRomana = flete.idSapEntrega < 0;
      const descartarObs$ = isRomana
        ? this.cflApi.descartarRomanaPendiente(Math.abs(flete.idSapEntrega), { motivo })
        : this.cflApi.descartarFletePendiente(flete.idSapEntrega, { motivo });
      descartarObs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.confirmActionSaving.set(false);
          this.closeConfirmAction();
          this.toast.show('Candidato descartado correctamente.');
          this.loadFletes();
        },
        error: (err) => {
          this.confirmActionSaving.set(false);
          if (this._handleAuthorizationError(err)) return;
          this.toast.show(err?.error?.error ?? 'No se pudo descartar el candidato.', true);
        },
      });
      return;
    }

    if (!flete.idCabeceraFlete) {
      this.confirmActionSaving.set(false);
      return;
    }

    this.cflApi.anularFlete(flete.idCabeceraFlete, { motivo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.confirmActionSaving.set(false);
        this.closeConfirmAction();
        this.toast.show('Flete anulado correctamente.');
        this.loadFletes();
      },
      error: (err) => {
        this.confirmActionSaving.set(false);
        if (this._handleAuthorizationError(err)) return;
        this.toast.show(err?.error?.error ?? 'No se pudo anular el flete.', true);
      },
    });
  }

  /*  Modal edición  */
  onEditGuardado(): void {
    this.editModalVisible.set(false);
    this.toast.show('Flete guardado exitosamente.');
    this.loadFletes();
  }

  onEditCerrado(): void {
    this.editModalVisible.set(false);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  /*  Permisos / roles  */
  canViewFlete(): boolean {
    return this.authz.hasAnyPermission(Perms.FLETES_CANDIDATOS_VIEW, Perms.FLETES_EDITAR, Perms.FLETES_CREAR);
  }

  canEditForFlete(flete: FleteTabla | null): boolean {
    if (!this._hasValidAuthState()) return false;
    if (!flete) {
      return this.authz.hasAnyPermission(Perms.FLETES_EDITAR, Perms.FLETES_CREAR);
    }
    if (flete.kind === 'candidato') {
      return this.authz.hasAnyPermission(Perms.FLETES_CREAR, Perms.FLETES_EDITAR);
    }
    return this.authz.hasPermission(Perms.FLETES_EDITAR);
  }

  canAnular(): boolean {
    return this.authz.hasPermission(Perms.FLETES_ANULAR);
  }

  canDescartar(): boolean {
    return this.authz.hasPermission(Perms.FLETES_SAP_DESCARTAR);
  }

  abrirConfirmarVaciar(): void {
    if (!this.canDescartar()) {
      this._showActionBlockedToast();
      return;
    }
    this.confirmarVaciarVisible.set(true);
  }

  cerrarConfirmarVaciar(): void {
    this.confirmarVaciarVisible.set(false);
  }

  ejecutarVaciarBandeja(): void {
    this.vaciandoBandeja.set(true);
    this.cflApi.descartarTodosCandidatos({ motivo: 'Descarte masivo de bandeja' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.vaciandoBandeja.set(false);
          this.cerrarConfirmarVaciar();
          this.toast.show(`Bandeja vaciada: ${res.data.descartados} candidato(s) descartados.`);
          this.loadFletes();
        },
        error: (err) => {
          this.vaciandoBandeja.set(false);
          if (this._handleAuthorizationError(err)) return;
          this.toast.show(err?.error?.error ?? 'No se pudo vaciar la bandeja.', true);
        },
      });
  }

  canAnularFlete(flete: FleteTabla): boolean {
    if (!this.canAnular()) return false;
    if (flete.kind !== 'en_curso') return false;
    return flete.estado !== 'ANULADO' && flete.estado !== 'FACTURADO';
  }

  areActionsBlocked(): boolean {
    return !this.auth.isLoggedIn() || !this.authz.loaded();
  }

  /**
   * Sentido del movimiento del flete, normalizado a DESPACHO | RETORNO.
   *  - Candidatos: usan `origenDatos` (DESPACHO | RECEPCION desde SAP/Romana).
   *  - Fletes en curso: usan `sentidoFlete` (IDA | VUELTA | DESPACHO | RETORNO).
   * Devuelve null si no se puede determinar (se omite el badge).
   */
  sentidoMovimiento(flete: FleteTabla): 'DESPACHO' | 'RETORNO' | null {
    if (flete.kind === 'candidato') {
      return flete.origenDatos === 'RECEPCION' ? 'RETORNO' : 'DESPACHO';
    }
    const s = (flete.sentidoFlete ?? '').toUpperCase();
    if (s === 'VUELTA' || s === 'RETORNO') return 'RETORNO';
    if (s === 'IDA' || s === 'DESPACHO') return 'DESPACHO';
    return null;
  }

  /*  Formatting  */
  formatMonto(monto: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto);
  }

  trackByFlete(_: number, f: FleteTabla): string {
    return f.id;
  }

  private _showActionBlockedToast(): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.show('Tu sesion ha expirado. Vuelve a iniciar sesion.', true);
      this.auth.logout();
      return;
    }

    if (!this.authz.loaded()) {
      this.toast.show('No se pudo verificar tu perfil. Intenta recargar la pagina.', true);
      return;
    }

    this.toast.show('No cuentas con permisos para realizar esta accion.', true);
  }

  private _handleAuthorizationError(err: { status?: number; error?: { error?: string } }): boolean {
    const status = Number(err?.status || 0);
    if (status === 401 || status === 403) {
      // El interceptor global ya maneja 401/403; AuthzService gestiona el contexto
      return true;
    }
    return false;
  }

  private _hasValidAuthState(): boolean {
    return this.auth.isLoggedIn() && this.authz.loaded();
  }
}
