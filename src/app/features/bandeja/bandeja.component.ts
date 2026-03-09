import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
import { EditFleteModalComponent, ModalMode } from './edit-flete-modal.component';

type ConfirmActionType = 'descartar' | 'anular';

@Component({
  selector: 'app-bandeja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, EditFleteModalComponent],
  templateUrl: './bandeja.component.html',
})
export class BandejaComponent implements OnInit {
  /*  User session  */
  get userName(): string {
    const u = this.auth.getCurrentUser();
    return u ? (u.nombre ? `${u.nombre} ${u.apellido ?? ''}`.trim() : u.username) : 'Usuario';
  }

  get userRole(): string {
    const fromContext = this.authRoles()[0];
    if (fromContext) return fromContext;
    return this.auth.getCurrentUser()?.role ?? '';
  }

  get roleLabel(): string {
    const map: Record<string, string> = {
      ingresador: 'Ingresador',
      autorizador: 'Autorizador',
      administrador: 'Administrador',
    };
    const normalizedRole = this._normalizedUserRole();
    return map[normalizedRole] ?? this.userRole;
  }

  get userInitials(): string {
    return this.userName.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  }

  /*  Tabs  */
  activeTab = signal<'candidatos' | 'en_curso'>('candidatos');

  /*  Data  */
  allFletes = signal<FleteTabla[]>([]);
  loading = signal(false);
  showUserMenu = signal(false);
  mobileSidebarOpen = signal(false);

  /*  Auth context (dinamico por DB)  */
  authContextLoaded = signal(false);
  authContextLoading = signal(false);
  authPermissions = signal<Set<string>>(new Set());
  authRoles = signal<string[]>([]);

  /*  Toast  */
  toastMsg = signal('');
  toastIsError = signal(false);
  private _toastTimer?: ReturnType<typeof setTimeout>;

  /*  Modal edición / vista  */
  editModalFlete = signal<FleteTabla | null>(null);
  editModalVisible = signal(false);
  editModalMode = signal<ModalMode>('edit');

  /*  Confirmación descartar/anular  */
  confirmActionVisible = signal(false);
  confirmActionType = signal<ConfirmActionType | null>(null);
  confirmActionFlete = signal<FleteTabla | null>(null);
  confirmActionMotivo = signal('');
  confirmActionSaving = signal(false);

  /*  Selección para folio  */
  selectedIds = signal<Set<string>>(new Set());

  /*  Paginación server-side  */
  currentPage = signal(1);
  itemsPerPage = signal(25);
  totalServerItems = signal(0);
  serverTotalPages = signal(0);

  /*  Filtros  */
  guiaFilter = signal('');
  estadoFilter = signal<LifecycleStatus | 'all'>('all');

  /*  Computed  */
  paginatedFletes = computed(() => this.allFletes());

  totalPages = computed(() => this.serverTotalPages() || 1);
  totalItems = computed(() => this.totalServerItems());

  canAsignarFolioComputed = computed(() => {
    if (!this.canAssignFolio()) return false;
    const sel = this.selectedIds();
    return sel.size > 0;
  });

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

  /*  Opciones estáticas  */
  estadoOptions: { value: LifecycleStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos (sin anulados)' },
    { value: 'DETECTADO', label: 'Detectado' },
    { value: 'ACTUALIZADO', label: 'Actualizado' },
    { value: 'EN_REVISION', label: 'En revisión' },
    { value: 'COMPLETADO', label: 'Completado' },
    { value: 'ASIGNADO_FOLIO', label: 'Asignado folio' },
    { value: 'FACTURADO', label: 'Facturado' },
    { value: 'ANULADO', label: 'Anulado' },
  ];
  itemsPerPageOptions = [10, 25, 50, 100];

  /*  Helpers de template  */
  readonly ESTADO_LABELS = ESTADO_LABELS;
  readonly ESTADO_BADGE = ESTADO_BADGE;
  readonly ESTADO_DOT = ESTADO_DOT;
  readonly ESTADO_HINT = ESTADO_HINT;

  constructor(
    private auth: AuthService,
    private cflApi: CflApiService,
  ) {}

  ngOnInit(): void {
    this._loadAuthContext();
    this.loadFletes();
  }

  /*  Carga de datos  */
  loadFletes(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());

    const page = this.currentPage();
    const page_size = this.itemsPerPage();
    const search = this.guiaFilter().trim() || undefined;
    const estado = this.estadoFilter() !== 'all' ? this.estadoFilter() : undefined;

    if (this.activeTab() === 'candidatos') {
      this.cflApi.getMissingFletes({ page, page_size, search }).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as CandidatoRow[]).map(adaptCandidato));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          if (this._handleAuthorizationError(err)) return;
          this._showToast(err?.error?.error ?? 'Error cargando candidatos SAP', true);
        },
      });
    } else {
      this.cflApi.getCompletosSinFolio({ page, page_size, search, estado }).subscribe({
        next: (res) => {
          this.allFletes.set((res.data as FleteEnCursoRow[]).map(adaptFleteEnCurso));
          this.totalServerItems.set(res.pagination.total);
          this.serverTotalPages.set(res.pagination.total_pages);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          if (this._handleAuthorizationError(err)) return;
          this._showToast(err?.error?.error ?? 'Error cargando fletes en curso', true);
        },
      });
    }
  }

  /*  Tabs  */
  setTab(tab: 'candidatos' | 'en_curso'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.guiaFilter.set('');
    this.estadoFilter.set('all');
    this.loadFletes();
  }

  /*  Filtros  */
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

  /*  Selección para folio  */
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
      this._showToast('Debes ingresar un motivo para continuar', true);
      return;
    }

    this.confirmActionSaving.set(true);

    if (action === 'descartar') {
      if (!flete.idSapEntrega) {
        this.confirmActionSaving.set(false);
        return;
      }

      this.cflApi.descartarFletePendiente(flete.idSapEntrega, { motivo }).subscribe({
        next: () => {
          this.confirmActionSaving.set(false);
          this.closeConfirmAction();
          this._showToast('Ingreso SAP descartado');
          this.loadFletes();
        },
        error: (err) => {
          this.confirmActionSaving.set(false);
          if (this._handleAuthorizationError(err)) return;
          this._showToast(err?.error?.error ?? 'Error al descartar ingreso SAP', true);
        },
      });
      return;
    }

    if (!flete.idCabeceraFlete) {
      this.confirmActionSaving.set(false);
      return;
    }

    this.cflApi.anularFlete(flete.idCabeceraFlete, { motivo }).subscribe({
      next: () => {
        this.confirmActionSaving.set(false);
        this.closeConfirmAction();
        this._showToast('Flete anulado');
        this.loadFletes();
      },
      error: (err) => {
        this.confirmActionSaving.set(false);
        if (this._handleAuthorizationError(err)) return;
        this._showToast(err?.error?.error ?? 'Error al anular flete', true);
      },
    });
  }

  /*  Modal edición  */
  onEditGuardado(): void {
    this.editModalVisible.set(false);
    this._showToast('Flete guardado correctamente');
    this.loadFletes();
  }

  onEditCerrado(): void {
    this.editModalVisible.set(false);
  }

  /*  Asignación de folio  */
  asignarFolioSeleccionados(): void {
    if (!this.canAssignFolio()) {
      this._showActionBlockedToast();
      return;
    }

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
      error: (err) => {
        if (this._handleAuthorizationError(err)) return;
        this._showToast(err?.error?.error ?? 'Error asignando folio', true);
      },
    });
  }

  /*  Auth  */
logout(): void {
    this.auth.logout();
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  /*  Permisos / roles  */
  canViewFlete(): boolean {
    return this._canUseByPermissions(['fletes.candidatos.view', 'fletes.editar', 'fletes.crear']);
  }

  canEditForFlete(flete: FleteTabla | null): boolean {
    if (!this._hasValidAuthState()) return false;
    if (!flete) {
      return this._canUseByPermissions(['fletes.editar', 'fletes.crear']);
    }
    if (flete.kind === 'candidato') {
      return this._canUseByPermissions(['fletes.crear', 'fletes.editar']);
    }
    return this._canUseByPermissions(['fletes.editar']);
  }

  canAssignFolio(): boolean {
    if (!this._hasValidAuthState()) return false;
    if (this._hasAnyRole(['autorizador', 'administrador'])) return true;
    return this._canUseByPermissions(['folios.asignar', 'folios.admin']);
  }

  canAnular(): boolean {
    if (!this._hasValidAuthState()) return false;
    if (this._hasAnyRole(['autorizador', 'administrador'])) return true;
    return this._canUseByPermissions(['fletes.anular']);
  }

  canDescartar(): boolean {
    if (!this._hasValidAuthState()) return false;
    if (this._hasAnyRole(['autorizador', 'administrador'])) return true;
    return this._canUseByPermissions(['fletes.sap.descartar']);
  }

  canAnularFlete(flete: FleteTabla): boolean {
    if (!this.canAnular()) return false;
    if (flete.kind !== 'en_curso') return false;
    return flete.estado !== 'ANULADO' && flete.estado !== 'FACTURADO';
  }

  areActionsBlocked(): boolean {
    return !this._hasValidAuthState();
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

  /*  Toast  */
  private _showToast(msg: string, isError = false): void {
    clearTimeout(this._toastTimer);
    this.toastMsg.set(msg);
    this.toastIsError.set(isError);
    this._toastTimer = setTimeout(() => this.toastMsg.set(''), 4000);
  }

  private _showActionBlockedToast(): void {
    if (!this.auth.isLoggedIn()) {
      this._showToast('Sesión expirada. Inicia sesión nuevamente.', true);
      this.auth.logout();
      return;
    }

    if (!this.authContextLoaded()) {
      this._showToast('No se pudo validar tu perfil. Acción bloqueada por seguridad.', true);
      return;
    }

    this._showToast('No tienes permisos para ejecutar esta acción', true);
  }

  private _handleAuthorizationError(err: { status?: number; error?: { error?: string } }): boolean {
    const status = Number(err?.status || 0);
    if (status === 401) {
      this._showToast('Tu sesión expiró. Inicia sesión nuevamente.', true);
      this.auth.logout();
      return true;
    }

    if (status === 403) {
      this._showToast(err?.error?.error ?? 'No tienes permisos para ejecutar esta acción', true);
      this._loadAuthContext();
      return true;
    }

    return false;
  }

  private _loadAuthContext(): void {
    this.authContextLoading.set(true);

    this.cflApi.getAuthContext().subscribe({
      next: (ctx) => {
        const roles = [ctx.data.role, ...(ctx.data.roles ?? [])]
          .map((role) => this._normalizeText(role))
          .filter((role): role is string => Boolean(role));
        const permissions = (ctx.data.permissions ?? [])
          .map((permission) => this._normalizeText(permission))
          .filter((permission): permission is string => Boolean(permission));

        this.authRoles.set(Array.from(new Set(roles)));
        this.authPermissions.set(new Set(permissions));
        this.authContextLoaded.set(true);
        this.authContextLoading.set(false);
      },
      error: (err) => {
        this.authRoles.set([]);
        this.authPermissions.set(new Set());
        this.authContextLoaded.set(false);
        this.authContextLoading.set(false);

        if (this._handleAuthorizationError(err)) return;
        this._showToast('No fue posible cargar permisos de usuario. Acciones bloqueadas.', true);
      },
    });
  }

  private _hasValidAuthState(): boolean {
    return this.auth.isLoggedIn() && this.authContextLoaded() && !this.authContextLoading();
  }

  private _canUseByPermissions(permissionKeys: string[]): boolean {
    if (!this._hasValidAuthState()) return false;
    if (this._isAdminContext()) return true;
    return permissionKeys.some((key) => this._hasPermission(key));
  }

  private _isAdminContext(): boolean {
    return this.authRoles().includes('administrador')
      || this.authRoles().includes('admin')
      || this._hasPermission('mantenedores.admin');
  }

  private _hasPermission(permissionKey: string): boolean {
    return this.authPermissions().has(this._normalizeText(permissionKey) || '');
  }

  private _hasAnyRole(roles: string[]): boolean {
    const roleSet = new Set(this.authRoles());
    return roles.some((role) => roleSet.has((this._normalizeText(role) || '')));
  }

  private _normalizeText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    return normalized || null;
  }

  private _normalizedUserRole(): string {
    return this._normalizeText(this.userRole) || '';
  }
}
