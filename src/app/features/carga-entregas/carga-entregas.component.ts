import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import {
  ControlFleteCargaJob,
  ControlFleteCargaJobEstado,
  ControlFleteCargaJobErrorItem,
  ControlFleteCargaJobResultadoItem,
  isControlFleteCargaJobTerminal,
  normalizeControlFleteCargaJobEstado,
} from '../../core/models/control-flete-carga-job.model';
import { Perms } from '../../core/config/permissions';
import { AuthzService } from '../../core/services/authz.service';
import { CflApiService } from '../../core/services/cfl-api.service';
import { DisabledIfNoPermissionDirective } from '../../core/directives/disabled-if-no-permission.directive';
import { ToastService } from '../../core/services/toast.service';
import { formatDateTime as formatDateTimeFn } from '../../core/utils/format.utils';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

type SolicitudMode = 'guia_despacho' | 'numero_entrega' | 'rango_fechas' | 'romana_fechas' | 'romana_npartida';
type CargaTab = 'despachos' | 'recepciones';

const STATUS_LABELS: Record<ControlFleteCargaJobEstado, string> = {
  PENDING: 'Pendiente',
  QUEUED: 'En cola',
  RUNNING: 'En ejecución',
  COMPLETED: 'Completado',
  PARTIAL_SUCCESS: 'Completado con observaciones',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
  UNKNOWN: 'Desconocido',
};

const STATUS_BADGE: Record<ControlFleteCargaJobEstado, string> = {
  PENDING:
    'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700',
  QUEUED:
    'inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700',
  RUNNING:
    'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700',
  COMPLETED:
    'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700',
  PARTIAL_SUCCESS:
    'inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700',
  FAILED:
    'inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700',
  CANCELLED:
    'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600',
  UNKNOWN:
    'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700',
};

const STATUS_PROGRESS_BAR: Record<ControlFleteCargaJobEstado, string> = {
  PENDING: 'bg-slate-400',
  QUEUED: 'bg-blue-500',
  RUNNING: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  PARTIAL_SUCCESS: 'bg-orange-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-slate-400',
  UNKNOWN: 'bg-slate-400',
};

const DEFAULT_POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-carga-entregas',
  imports: [FormsModule, WorkspaceShellComponent, DisabledIfNoPermissionDirective],
  templateUrl: './carga-entregas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CargaEntregasComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private authz = inject(AuthzService);

  /* ── Tab activo ──────────────────────────────────────────────── */
  activeTab = signal<CargaTab>('despachos');

  /* ── Solicitud de carga (Despachos) ────────────────────────── */
  guiasDespachoInput = signal('');
  numerosEntregaInput = signal('');
  fechaDesde = signal('');
  fechaHasta = signal('');
  submitting = signal<SolicitudMode | null>(null);

  /* ── Solicitud de carga (Recepciones / Romana) ─────────────── */
  romanaCentro = signal('');
  romanaFechaDesde = signal('');
  romanaFechaHasta = signal('');
  romanaNPartida = signal('');
  romanaGuia = signal('');
  romanaSubmitting = signal(false);
  romanaResult = signal<{ message: string; totals?: Record<string, number> } | null>(null);

  /* ── Estado de ejecución ────────────────────────────────────── */
  solicitudId = signal('');
  solicitud = signal<ControlFleteCargaJob | null>(null);
  solicitudLoading = signal(false);
  autoRefresh = signal(true);
  lastRefreshedAt = signal<string | null>(null);

  /* ── Historial de ejecuciones ─────────────────────────────── */
  recentJobs = signal<ControlFleteCargaJob[]>([]);
  recentJobsLoading = signal(false);

  private toast = inject(ToastService);

  /* ── Timers ─────────────────────────────────────────────────── */
  private _pollTimer?: ReturnType<typeof setTimeout>;

  /* ── Computed ───────────────────────────────────────────────── */
  parsedGuiasDespacho = computed(() => this._parseEntregaList(this.guiasDespachoInput()));
  parsedNumerosEntrega = computed(() => this._parseEntregaList(this.numerosEntregaInput()));

  currentStatus = computed<ControlFleteCargaJobEstado>(() =>
    normalizeControlFleteCargaJobEstado(this.solicitud()?.estado),
  );

  currentResults = computed<ControlFleteCargaJobResultadoItem[]>(() =>
    this.solicitud()?.resultados ?? [],
  );

  currentErrors = computed<ControlFleteCargaJobErrorItem[]>(() =>
    this.solicitud()?.errores ?? [],
  );

  isPolling = computed(
    () =>
      Boolean(this.solicitud()) &&
      this.autoRefresh() &&
      !isControlFleteCargaJobTerminal(this.solicitud()?.estado),
  );

  constructor(
    private cflApi: CflApiService,
  ) {}

  ngOnInit(): void {
    this._setDefaultDateRange();
    this._setDefaultRomanaDateRange();
    this._loadRecentJobs();
    this._autoResumeLatestJob();
  }

  ngOnDestroy(): void {
    this._clearPollTimer();
  }

  /* ── Acciones de solicitud ──────────────────────────────────── */

  solicitarPorGuiaDespacho(): void {
    const guias = this.parsedGuiasDespacho();
    if (guias.length === 0) {
      this.toast.show('Ingresa al menos una guia de despacho.', true);
      return;
    }

    this.submitting.set('guia_despacho');

    this.cflApi
      .solicitarControlFleteCargaPorXblnr({ xblnr: guias })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(null);
          this.guiasDespachoInput.set('');
          const id = String(response.data?.job_id ?? '').trim();
          if (!id) {
            this.toast.show('No se recibio una respuesta valida del servidor.', true);
            return;
          }

          this.solicitudId.set(id);

          if (response.data?.estado) {
            this._applySolicitudState(response.data, true);
          } else {
            this._loadSolicitud(id, false, false);
          }

          this.toast.show('Carga por guia de despacho iniciada. Procesando...');
          this._refreshRecentJobs();
        },
        error: (err) => {
          this.submitting.set(null);
          if (this._handleAuthError(err)) return;

          const existingId = String(err?.error?.data?.existing_job_id ?? '').trim();
          if (err?.status === 409 && existingId) {
            this.solicitudId.set(existingId);
            this._loadSolicitud(existingId, true, false);
            this.toast.show(
              'Ya existe una solicitud activa para estas guías. Se muestra su estado actual.',
              true,
            );
            return;
          }
          this.toast.show(err?.error?.error ?? 'No se pudo iniciar la carga. Intenta nuevamente.', true);
        },
      });
  }

  solicitarPorNumeroEntrega(): void {
    const numeros = this.parsedNumerosEntrega();
    if (numeros.length === 0) {
      this.toast.show('Ingresa al menos un numero de entrega.', true);
      return;
    }

    this.submitting.set('numero_entrega');

    this.cflApi
      .solicitarControlFleteCargaPorVbeln({ vbeln: numeros })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(null);
          this.numerosEntregaInput.set('');
          const id = String(response.data?.job_id ?? '').trim();
          if (!id) {
            this.toast.show('No se recibio una respuesta valida del servidor.', true);
            return;
          }

          this.solicitudId.set(id);

          if (response.data?.estado) {
            this._applySolicitudState(response.data, true);
          } else {
            this._loadSolicitud(id, false, false);
          }

          this.toast.show('Carga por numero de entrega iniciada. Procesando...');
          this._refreshRecentJobs();
        },
        error: (err) => {
          this.submitting.set(null);
          if (this._handleAuthError(err)) return;

          const existingId = String(err?.error?.data?.existing_job_id ?? '').trim();
          if (err?.status === 409 && existingId) {
            this.solicitudId.set(existingId);
            this._loadSolicitud(existingId, true, false);
            this.toast.show(
              'Ya existe una solicitud activa para estas entregas. Se muestra su estado actual.',
              true,
            );
            return;
          }
          this.toast.show(err?.error?.error ?? 'No se pudo iniciar la carga. Intenta nuevamente.', true);
        },
      });
  }

  solicitarPorRangoFechas(): void {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();

    if (!desde || !hasta) {
      this.toast.show('Selecciona una fecha de inicio y una de termino.', true);
      return;
    }

    if (desde > hasta) {
      this.toast.show('La fecha de inicio debe ser anterior o igual a la de termino.', true);
      return;
    }

    this.submitting.set('rango_fechas');

    this.cflApi
      .solicitarControlFleteCargaPorRangoFechas({ fecha_desde: desde, fecha_hasta: hasta })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(null);
          const id = String(response.data?.job_id ?? '').trim();
          if (!id) {
            this.toast.show('No se recibio una respuesta valida del servidor.', true);
            return;
          }

          this.solicitudId.set(id);

          if (response.data?.estado) {
            this._applySolicitudState(response.data, true);
          } else {
            this._loadSolicitud(id, false, false);
          }

          this.toast.show('Carga por rango de fechas iniciada. Procesando...');
          this._refreshRecentJobs();
        },
        error: (err) => {
          this.submitting.set(null);
          if (this._handleAuthError(err)) return;

          const existingId = String(err?.error?.data?.existing_job_id ?? '').trim();
          if (err?.status === 409 && existingId) {
            this.solicitudId.set(existingId);
            this._loadSolicitud(existingId, true, false);
            this.toast.show(
              'Ya existe una solicitud activa para este rango. Se muestra su estado actual.',
              true,
            );
            return;
          }
          this.toast.show(
            err?.error?.error ?? 'No fue posible enviar la solicitud por rango de fechas.',
            true,
          );
        },
      });
  }

  /* ── Solicitud Romana ────────────────────────────────────────── */

  solicitarRomanaFechas(): void {
    const centro = this.romanaCentro().trim();
    if (!centro) { this.toast.show('Ingresa el centro (Werks) antes de continuar.', true); return; }
    const desde = this.romanaFechaDesde();
    const hasta = this.romanaFechaHasta();
    if (!desde || !hasta) { this.toast.show('Selecciona las fechas de inicio y termino.', true); return; }
    if (desde > hasta) { this.toast.show('La fecha de inicio debe ser anterior o igual a la de termino.', true); return; }

    this._submitRomana(this.cflApi.cargarRomanaRangoFechas({ centro, fecha_desde: desde, fecha_hasta: hasta }));
  }

  solicitarRomanaNPartida(): void {
    const centro = this.romanaCentro().trim();
    if (!centro) { this.toast.show('Ingresa el centro (Werks) antes de continuar.', true); return; }
    const nPartida = this.romanaNPartida().trim();
    if (!nPartida) { this.toast.show('Ingresa el numero de partida.', true); return; }
    this._submitRomana(this.cflApi.cargarRomanaNPartida({ centro, n_partida: nPartida }));
  }

  solicitarRomanaGuia(): void {
    const centro = this.romanaCentro().trim();
    if (!centro) { this.toast.show('Ingresa el centro (Werks) antes de continuar.', true); return; }
    const guia = this.romanaGuia().trim();
    if (!guia) { this.toast.show('Ingresa la guia de despacho.', true); return; }
    this._submitRomana(this.cflApi.cargarRomanaGuia({ centro, guia }));
  }

  private _submitRomana(obs$: import('rxjs').Observable<unknown>): void {
    this.romanaSubmitting.set(true);
    this.romanaResult.set(null);
    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.romanaSubmitting.set(false);
        this.romanaResult.set(res.data);
        this.toast.show(res.data?.message || 'Carga de recepciones completada.');
      },
      error: (err) => {
        this.romanaSubmitting.set(false);
        this.toast.show(err?.error?.error || 'No se pudieron cargar las recepciones. Verifica los parametros.', true);
      },
    });
  }

  /* ── Consulta de estado ─────────────────────────────────────── */

  refrescarSolicitud(): void {
    const id = this.solicitud()?.job_id ?? this.solicitudId().trim();
    if (!id) return;
    this._loadSolicitud(id, true, false);
  }

  toggleAutoRefresh(): void {
    const next = !this.autoRefresh();
    this.autoRefresh.set(next);

    const current = this.solicitud();
    if (!current) return;

    if (next && !isControlFleteCargaJobTerminal(current.estado)) {
      this._schedulePoll(current);
      return;
    }

    this._clearPollTimer();
  }

  /* ── Display helpers ────────────────────────────────────────── */

  statusLabel(): string {
    return STATUS_LABELS[this.currentStatus()];
  }

  statusBadgeClass(): string {
    return STATUS_BADGE[this.currentStatus()];
  }

  progressBarClass(): string {
    return STATUS_PROGRESS_BAR[this.currentStatus()];
  }

  progress(): number {
    const s = this.solicitud();
    if (!s) return 0;

    const explicit = this._toNumber(s.porcentaje_avance);
    if (explicit > 0) return Math.min(100, explicit);

    const solicitados = this._toNumber(s.resumen?.solicitados);
    const procesados = this._toNumber(s.resumen?.procesados);
    if (solicitados > 0) return Math.min(100, Math.round((procesados / solicitados) * 100));

    return isControlFleteCargaJobTerminal(s.estado) ? 100 : 0;
  }

  requestLabel(): string {
    const s = this.solicitud();
    if (!s) return '-';

    if (s.tipo_solicitud === 'xblnr') {
      const refs = s.parametros?.xblnr ?? [];
      if (refs.length === 0) return 'Carga por guía de despacho';
      if (refs.length === 1) return `Guía ${refs[0]}`;
      return `${refs.length} guías solicitadas`;
    }

    if (s.tipo_solicitud === 'vbeln') {
      const nums = s.parametros?.vbeln ?? [];
      if (nums.length === 0) return 'Carga por número de entrega';
      if (nums.length === 1) return `Entrega ${nums[0]}`;
      return `${nums.length} entregas solicitadas`;
    }

    const desde = s.parametros?.fecha_desde ?? '-';
    const hasta = s.parametros?.fecha_hasta ?? '-';
    return `Período ${desde} al ${hasta}`;
  }

  durationLabel(): string {
    const s = this.solicitud();
    if (!s) return '-';

    const startRaw = s.iniciado_en ?? s.creado_en;
    const endRaw = s.finalizado_en ?? s.actualizado_en;
    if (!startRaw || !endRaw) return '-';

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '-';

    const totalSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m ${seconds}s`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  statusMessage(): string {
    const s = this.solicitud();
    if (!s) return 'Sin solicitud activa';
    return s.mensaje?.trim() || s.etapa_actual?.trim() || 'Procesando...';
  }

  formatTimestamp(value: string | null | undefined): string {
    return formatDateTimeFn(value);
  }

  toNumber(value: unknown): number {
    return this._toNumber(value);
  }

  trackResult(_: number, item: ControlFleteCargaJobResultadoItem): string {
    return `${item.vbeln ?? item.sap_numero_entrega ?? 'r'}-${item.id_sap_entrega ?? item.id_cabecera_flete ?? _}`;
  }

  trackError(_: number, item: ControlFleteCargaJobErrorItem): string {
    return `${item.codigo ?? item.vbeln ?? 'e'}-${item.mensaje ?? _}`;
  }

  /* ── Permisos ───────────────────────────────────────────────── */

  canExecuteLoad(): boolean {
    return this.authz.hasPermission(Perms.FLETES_SAP_ETL_EJECUTAR);
  }

  canViewLoadStatus(): boolean {
    return this.authz.hasAnyPermission(Perms.FLETES_SAP_ETL_VER, Perms.FLETES_SAP_ETL_EJECUTAR);
  }

  actionsBlocked(): boolean {
    return !this.authz.loaded();
  }

  /* ── Private: Polling & solicitud state ─────────────────────── */

  private _loadSolicitud(id: string, showLoader: boolean, fromPolling: boolean): void {
    if (showLoader) this.solicitudLoading.set(true);

    this.cflApi.getControlFleteCargaJob(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.solicitudLoading.set(false);
        this._applySolicitudState(response.data, !fromPolling);
      },
      error: (err) => {
        this.solicitudLoading.set(false);
        this._clearPollTimer();
        if (this._handleAuthError(err)) return;
        this.toast.show(
          err?.error?.error ?? `No fue posible consultar la solicitud ${id}.`,
          true,
        );
      },
    });
  }

  private _applySolicitudState(data: ControlFleteCargaJob, resetNotice: boolean): void {
    if (resetNotice) this._lastTerminalKey = null;

    this.solicitud.set(data);
    this.solicitudId.set(data.job_id);
    this.lastRefreshedAt.set(new Date().toISOString());

    if (this.autoRefresh() && !isControlFleteCargaJobTerminal(data.estado)) {
      this._schedulePoll(data);
      return;
    }

    this._clearPollTimer();
    this._notifyTerminal(data);
  }

  private _schedulePoll(data: ControlFleteCargaJob): void {
    this._clearPollTimer();
    if (!this.autoRefresh() || isControlFleteCargaJobTerminal(data.estado)) return;

    const interval = this._toNumber(data.poll_interval_ms) || DEFAULT_POLL_INTERVAL_MS;
    this._pollTimer = setTimeout(() => {
      const id = this.solicitud()?.job_id ?? data.job_id;
      if (!id || !this.autoRefresh()) return;
      this._loadSolicitud(id, false, true);
    }, interval);
  }

  private _clearPollTimer(): void {
    clearTimeout(this._pollTimer);
    this._pollTimer = undefined;
  }

  private _lastTerminalKey: string | null = null;

  private _notifyTerminal(data: ControlFleteCargaJob): void {
    const normalized = normalizeControlFleteCargaJobEstado(data.estado);
    if (!isControlFleteCargaJobTerminal(normalized)) return;

    const key = `${data.job_id}:${normalized}`;
    if (this._lastTerminalKey === key) return;
    this._lastTerminalKey = key;

    switch (normalized) {
      case 'COMPLETED':
        this.toast.show('Carga completada exitosamente.');
        break;
      case 'PARTIAL_SUCCESS':
        this.toast.show('Carga completada con observaciones. Revisa el detalle.', true);
        break;
      case 'FAILED':
        this.toast.show('La carga no pudo completarse. Revisa los errores.', true);
        break;
      case 'CANCELLED':
        this.toast.show('Carga cancelada.', true);
        break;
    }

    this._refreshRecentJobs();
  }

  private _handleAuthError(err: { status?: number; error?: { error?: string } }): boolean {
    const status = Number(err?.status || 0);
    // 401/403 ya los maneja el interceptor global (toast + logout)
    return status === 401 || status === 403;
  }

  /* ── Historial: acciones ────────────────────────────────────── */

  selectHistoryJob(job: ControlFleteCargaJob): void {
    this.solicitudId.set(job.job_id);
    this._applySolicitudState(job, true);
  }

  historyJobLabel(job: ControlFleteCargaJob): string {
    if (job.tipo_solicitud === 'xblnr') {
      const refs = job.parametros?.xblnr ?? [];
      if (refs.length === 0) return 'Carga por XBLNR';
      if (refs.length === 1) return `Guía ${refs[0]}`;
      return `${refs.length} guías`;
    }
    if (job.tipo_solicitud === 'vbeln') {
      const nums = job.parametros?.vbeln ?? [];
      if (nums.length === 0) return 'Carga por VBELN';
      if (nums.length === 1) return `Entrega ${nums[0]}`;
      return `${nums.length} entregas`;
    }
    const desde = job.parametros?.fecha_desde ?? '?';
    const hasta = job.parametros?.fecha_hasta ?? '?';
    return `${desde} al ${hasta}`;
  }

  historyStatusClass(job: ControlFleteCargaJob): string {
    const estado = normalizeControlFleteCargaJobEstado(job.estado);
    return STATUS_BADGE[estado];
  }

  historyStatusLabel(job: ControlFleteCargaJob): string {
    return STATUS_LABELS[normalizeControlFleteCargaJobEstado(job.estado)];
  }

  isSelectedJob(job: ControlFleteCargaJob): boolean {
    return this.solicitud()?.job_id === job.job_id;
  }

  /* ── Private: Historial & auto-resume ─────────────────────── */

  private _loadRecentJobs(): void {
    this.recentJobsLoading.set(true);
    this.cflApi.getControlFleteCargaRecentJobs(20).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.recentJobsLoading.set(false);
        this.recentJobs.set(response.data ?? []);
      },
      error: () => {
        this.recentJobsLoading.set(false);
      },
    });
  }

  private _autoResumeLatestJob(): void {
    this.cflApi.getControlFleteCargaLatestJob().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const job = response.data;
        if (!job) return;
        if (!isControlFleteCargaJobTerminal(job.estado)) {
          this.solicitudId.set(job.job_id);
          this._applySolicitudState(job, true);
        }
      },
      error: () => {},
    });
  }

  private _refreshRecentJobs(): void {
    this.cflApi.getControlFleteCargaRecentJobs(20).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.recentJobs.set(response.data ?? []);
      },
      error: () => {},
    });
  }

  /* ── Private: Utilities ─────────────────────────────────────── */


  private _setDefaultDateRange(): void {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 10);
    this.fechaHasta.set(this._fmtDate(today));
    this.fechaDesde.set(this._fmtDate(from));
  }

  private _setDefaultRomanaDateRange(): void {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 7);
    this.romanaFechaHasta.set(this._fmtDate(today));
    this.romanaFechaDesde.set(this._fmtDate(from));
  }

  private _fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private _parseEntregaList(value: string): string[] {
    return Array.from(
      new Set(
        value
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    );
  }

  private _toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
