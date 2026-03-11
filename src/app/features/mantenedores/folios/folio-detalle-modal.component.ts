import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CflApiService } from '../../../core/services/cfl-api.service';

@Component({
    selector: 'app-folio-detalle-modal',
    imports: [FormsModule],
    template: `
    @if (visible) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="onBackdropClick($event)"
      >
        <div
          class="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <div>
              <h2 class="text-lg font-bold text-white">
                Folio N° {{ folio['folio_numero'] }}
              </h2>
              <p class="text-xs text-green-200 mt-0.5">
                {{ folio['centro_costo_nombre'] }} · {{ folio['temporada_codigo'] }} ·
                <span class="font-semibold">{{ folio['estado'] }}</span>
              </p>
            </div>
            <button type="button" (click)="cerrado.emit()" class="text-white/70 hover:text-white transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-6 space-y-6">

            <!-- ── Sección: Fletes asignados ── -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-forest-800 uppercase tracking-wide">
                  Movimientos asignados
                  <span class="ml-2 inline-flex items-center rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-700">
                    {{ movimientos().length }}
                  </span>
                </h3>
                <button type="button" (click)="loadMovimientos()" class="btn-ghost !text-xs !px-2 !py-1.5">
                  <svg class="h-3.5 w-3.5" [class.animate-spin]="loadingMovimientos()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Actualizar
                </button>
              </div>

              @if (loadingMovimientos()) {
                <div class="flex items-center justify-center py-8">
                  <svg class="animate-spin w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              } @else {
                <div class="rounded-xl border border-forest-100 overflow-hidden">
                  <table class="min-w-full">
                    <thead>
                      <tr class="bg-forest-50 border-b border-forest-100">
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">N° Entrega SAP</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Tipo Flete</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Fecha</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Monto</th>
                        <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-forest-600">Estado</th>
                        @if (folioEditable) {
                          <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-forest-600">Acción</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-50">
                      @for (mov of movimientos(); track $any(mov)['id_cabecera_flete']) {
                        <tr class="hover:bg-forest-50 transition-colors">
                          <td class="px-3 py-2 font-mono text-xs text-forest-800">{{ $any(mov)['sap_numero_entrega'] ?? '—' }}</td>
                          <td class="px-3 py-2 text-xs text-forest-700">{{ $any(mov)['tipo_flete_nombre'] ?? '—' }}</td>
                          <td class="px-3 py-2 text-xs text-forest-600">{{ formatDate($any(mov)['fecha_salida']) }}</td>
                          <td class="px-3 py-2 text-right text-xs font-mono font-semibold text-forest-800">{{ formatMonto($any(mov)['monto_aplicado']) }}</td>
                          <td class="px-3 py-2 text-center">
                            <span class="badge text-[10px]" [class]="getEstadoBadge($any(mov)['estado'])">
                              {{ $any(mov)['estado'] }}
                            </span>
                          </td>
                          @if (folioEditable) {
                            <td class="px-3 py-2 text-center">
                              @if ($any(mov)['can_desasignar']) {
                                <button
                                  type="button"
                                  (click)="desasignar($any(mov)['id_cabecera_flete'])"
                                  [disabled]="desasignando() === $any(mov)['id_cabecera_flete']"
                                  class="btn-danger !px-2 !py-1 !text-[10px]"
                                  title="Desasociar del folio"
                                >
                                  @if (desasignando() === $any(mov)['id_cabecera_flete']) {
                                    <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                  } @else {
                                    Desasociar
                                  }
                                </button>
                              }
                            </td>
                          }
                        </tr>
                      }
                      @if (movimientos().length === 0) {
                        <tr>
                          <td [attr.colspan]="folioEditable ? 6 : 5" class="px-3 py-8 text-center text-xs text-forest-400">
                            Sin movimientos asignados a este folio.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <!-- ── Sección: Asignar nuevo movimiento (solo si ABIERTO) ── -->
            @if (folioEditable) {
              <div class="rounded-xl border-2 border-dashed border-forest-200 bg-forest-50 p-4">
                <h3 class="text-sm font-bold text-forest-700 uppercase tracking-wide mb-3">
                  Asignar movimiento SAP
                </h3>
                <p class="text-xs text-forest-500 mb-3">
                  Ingresa el número de entrega SAP de un movimiento en estado
                  <strong>COMPLETADO o ASIGNADO_FOLIO</strong> para asignarlo a este folio.
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    class="cfl-input flex-1 max-w-xs"
                    placeholder="N° Entrega SAP (Ej: 0080012345)"
                    [(ngModel)]="sapInput"
                    name="sapInput"
                    (keyup.enter)="asignarSap()"
                  />
                  <button
                    type="button"
                    (click)="asignarSap()"
                    [disabled]="!sapInput.trim() || asignando()"
                    class="btn-primary"
                  >
                    @if (asignando()) {
                      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Asignando...
                    } @else {
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                      </svg>
                      Asignar
                    }
                  </button>
                </div>
                @if (errorMsg()) {
                  <p class="mt-2 text-xs text-red-600">{{ errorMsg() }}</p>
                }
                @if (successMsg()) {
                  <p class="mt-2 text-xs text-emerald-600">{{ successMsg() }}</p>
                }
              </div>
            }

            <!-- ── Info si no está ABIERTO ── -->
            @if (folioBloqueado) {
              <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                Este folio está <strong>bloqueado</strong>. Desbloquéalo desde la lista de folios para poder modificarlo.
              </div>
            } @else if (!folioAbierto) {
              <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Este folio está en estado <strong>{{ folio['estado'] }}</strong>.
                Solo se pueden asignar o desasignar movimientos en folios <strong>ABIERTO</strong>.
              </div>
            }

            <!-- Footer -->
            <div class="flex justify-end pt-2">
              <button type="button" (click)="cerrado.emit()" class="btn-secondary">Cerrar</button>
            </div>

          </div><!-- /body -->
        </div>
      </div>
    }
  `
})
export class FolioDetalleModalComponent implements OnChanges {
  @Input() folio: Record<string, unknown> = {};
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado  = new EventEmitter<void>();

  movimientos      = signal<Record<string, unknown>[]>([]);
  loadingMovimientos = signal(false);
  asignando        = signal(false);
  desasignando     = signal<number | null>(null);
  errorMsg         = signal('');
  successMsg       = signal('');

  sapInput = '';

  get folioAbierto(): boolean {
    return String(this.folio?.['estado'] ?? '').toUpperCase() === 'ABIERTO';
  }

  get folioBloqueado(): boolean {
    return this.folio?.['bloqueado'] === true || this.folio?.['bloqueado'] === 1;
  }

  get folioEditable(): boolean {
    return this.folioAbierto && !this.folioBloqueado;
  }

  constructor(private api: CflApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.sapInput = '';
      this.errorMsg.set('');
      this.successMsg.set('');
      this.loadMovimientos();
    }
  }

  loadMovimientos(): void {
    const idFolio = Number(this.folio?.['id_folio']);
    if (!idFolio) return;

    this.loadingMovimientos.set(true);
    this.api.getFolioMovimientos(idFolio).subscribe({
      next: (res) => {
        this.movimientos.set(res.data as Record<string, unknown>[]);
        this.loadingMovimientos.set(false);
      },
      error: () => { this.loadingMovimientos.set(false); },
    });
  }

  asignarSap(): void {
    const sap = this.sapInput.trim();
    if (!sap || !this.folioEditable) return;

    const idFolio = Number(this.folio?.['id_folio']);
    this.asignando.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.api.asignarSapAFolio(idFolio, sap).subscribe({
      next: (res: any) => {
        this.asignando.set(false);
        this.sapInput = '';
        this.successMsg.set(`Movimiento ${sap} asignado correctamente.`);
        this.loadMovimientos();
        this.guardado.emit();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al asignar el movimiento');
        this.asignando.set(false);
      },
    });
  }

  desasignar(idCabeceraFlete: number): void {
    if (!this.folioEditable) return;
    const idFolio = Number(this.folio?.['id_folio']);
    this.desasignando.set(idCabeceraFlete);
    this.errorMsg.set('');

    this.api.desasignarMovimientoDeFolio(idFolio, idCabeceraFlete).subscribe({
      next: () => {
        this.desasignando.set(null);
        this.successMsg.set('Movimiento desasignado correctamente.');
        this.loadMovimientos();
        this.guardado.emit();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al desasignar');
        this.desasignando.set(null);
      },
    });
  }

  formatDate(val: unknown): string {
    if (!val) return '—';
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('es-CL');
  }

  formatMonto(val: unknown): string {
    if (val === null || val === undefined || val === '') return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
    }).format(Number(val));
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADO:     'badge-completado',
      ASIGNADO_FOLIO: 'badge-asignado-folio',
      FACTURADO:      'badge-facturado',
      ANULADO:        'badge-anulado',
    };
    return map[estado ?? ''] ?? 'badge bg-slate-100 text-slate-600 border-slate-200';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.cerrado.emit();
  }
}
