import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { DisabledIfNoPermissionDirective } from '../../core/directives/disabled-if-no-permission.directive';
import { MovimientoPlanillaRow, OrdenCompraOption, PlanillaSapDetalle, PlanillaSapFacturaVinculada } from '../../core/models/planilla-sap.model';
import { CflApiService } from '../../core/services/cfl-api.service';
import { formatCLP, formatDate, triggerDownload } from '../../core/utils/format.utils';
import { SearchableComboboxComponent, SearchableOption } from '../bandeja/searchable-combobox.component';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

const ESTADO_LABELS: Record<string, string> = {
  generada: 'Generada',
  enviada: 'Enviada',
  anulada: 'Anulada',
};

const ESTADO_CHIP: Record<string, string> = {
  generada: 'bg-slate-100 text-slate-700',
  enviada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
};

interface FacturaElegible {
  id_factura: number;
  numero_factura: string;
  fecha_emision: string;
  empresa_nombre: string;
  monto_total: number;
}

interface AgregarProductorOc {
  id_productor: number;
  codigo_proveedor: string;
  nombre: string;
  monto: number;
  especie: string;
  orden_compra: string;
  posicion_oc: string;
}

@Component({
  selector: 'app-planilla-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, WorkspaceShellComponent, DisabledIfNoPermissionDirective, SearchableComboboxComponent],
  template: `
    <app-workspace-shell
      [title]="planilla() ? 'Planilla SAP — ' + planilla()!.periodo_label : 'Detalle Planilla SAP'"
      subtitle="Detalle de la planilla SAP generada con sus documentos y líneas."
      activeSection="planillas">

      <!-- Breadcrumb -->
      <div class="mb-4 flex items-center gap-2 text-sm text-forest-500">
        <a routerLink="/planillas-sap" class="inline-flex items-center justify-center rounded-lg p-1.5 text-forest-500 hover:bg-forest-100 hover:text-forest-900 transition" title="Volver a Planillas SAP">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <a routerLink="/planillas-sap" class="hover:text-forest-900 transition">Planillas SAP</a>
        <span>›</span>
        <span class="text-forest-900">{{ planilla()?.periodo_label ?? 'Cargando...' }}</span>
      </div>

      @if (loading()) {
        <div class="rounded-2xl border border-forest-100 bg-white px-6 py-10 text-center text-sm text-forest-500 shadow-sm">
          Cargando planilla...
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{{ error() }}</div>
      } @else if (planilla()) {

        <!-- Cabecera -->
        <div class="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-bold text-forest-900">Planilla SAP</h1>
                <span class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      [class]="estadoChip(planilla()!.estado)">
                  {{ estadoLabel(planilla()!.estado) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-forest-600">{{ planilla()!.empresa_nombre }}</p>
              <p class="mt-1 text-xs text-forest-500">{{ planilla()!.glosa_cabecera }}</p>
            </div>
            <div class="rounded-2xl border border-forest-100 bg-forest-50 px-5 py-3 text-right">
              <p class="text-xs font-semibold uppercase tracking-widest text-forest-500">Monto Total</p>
              <p class="text-2xl font-bold text-teal-700">{{ formatCLP(planilla()!.monto_total) }}</p>
              <p class="text-xs text-forest-500">
                {{ planilla()!.total_documentos }} doc(s) · {{ planilla()!.total_lineas }} líneas
              </p>
            </div>
          </div>

          <!-- Metadata -->
          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Fecha documento</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatDate(planilla()!.fecha_documento) }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Fecha contabilización</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ formatDate(planilla()!.fecha_contabilizacion) }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Temporada</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ planilla()!.temporada || '-' }}</p>
            </div>
            <div class="rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-forest-500">Cargo/Abono</p>
              <p class="mt-1 text-sm font-semibold text-forest-900">{{ planilla()!.codigo_cargo_abono || '-' }}</p>
            </div>
          </div>

          <!-- Acciones -->
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Descargar planilla SAP como Excel"
                    (click)="descargar()"
                    class="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
              Descargar Excel
            </button>
            @if (planilla()!.estado === 'generada') {
              <button type="button" (click)="confirmarEnvio()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                Marcar como enviada
              </button>
              <button type="button" (click)="confirmarAnulacion()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                Anular planilla
              </button>
            }
          </div>
          @if (actionError()) {
            <div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {{ actionError() }}
            </div>
          }
        </div>

        <!-- Pre Facturas incluidas -->
        <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-sm font-semibold text-forest-900">Pre Facturas incluidas</h2>
            @if (planilla()!.estado === 'generada') {
              <button type="button" (click)="toggleAgregarPanel()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition">
                + Agregar pre facturas
              </button>
            }
          </div>

          <!-- Panel agregar pre facturas -->
          @if (showAgregarPanel()) {
            <div class="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-teal-700">Pre facturas disponibles (mismo período)</h3>
                <button type="button" (click)="showAgregarPanel.set(false)"
                        class="text-xs text-teal-500 hover:text-teal-800">Cerrar</button>
              </div>
              @if (loadingElegibles()) {
                <p class="text-sm text-teal-600">Cargando...</p>
              } @else if (facturasElegibles().length === 0) {
                <p class="text-sm text-teal-600">No hay pre facturas disponibles en el mismo período.</p>
              } @else {
                <div class="overflow-x-auto rounded-lg border border-teal-100">
                  <table class="min-w-full divide-y divide-teal-100 text-sm">
                    <thead>
                      <tr class="text-left text-xs uppercase tracking-wider text-teal-600 bg-teal-100/50">
                        <th class="px-3 py-2">Pre Factura</th>
                        <th class="px-3 py-2">Empresa</th>
                        <th class="px-3 py-2">Emisión</th>
                        <th class="px-3 py-2 text-right">Monto</th>
                        <th class="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-teal-50">
                      @for (fac of facturasElegibles(); track fac.id_factura) {
                        <tr class="hover:bg-teal-50/50">
                          <td class="px-3 py-2 font-medium text-forest-900">{{ fac.numero_factura }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ fac.empresa_nombre }}</td>
                          <td class="px-3 py-2 text-forest-600">{{ formatDate(fac.fecha_emision) }}</td>
                          <td class="px-3 py-2 text-right font-semibold text-forest-900">{{ formatCLP(fac.monto_total) }}</td>
                          <td class="px-3 py-2">
                            <button type="button" (click)="agregarFactura(fac)" [disabled]="actionBusy()"
                                    [disabledIfNoPermission]="'planillas.generar'"
                                    class="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                              Agregar
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- Tabla de facturas vinculadas -->
          <div class="overflow-x-auto rounded-xl border border-forest-100">
            <table class="min-w-full divide-y divide-forest-100 text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500 bg-forest-50">
                  <th class="px-4 py-3">Pre Factura</th>
                  <th class="px-4 py-3">Empresa</th>
                  @if (planilla()!.estado === 'generada') {
                    <th class="px-4 py-3"></th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-forest-100">
                @for (fac of planilla()!.facturas; track fac.id_factura) {
                  <tr>
                    <td class="px-4 py-3 font-medium text-forest-900">{{ fac.numero_factura }}</td>
                    <td class="px-4 py-3 text-forest-600">{{ fac.empresa_nombre }}</td>
                    @if (planilla()!.estado === 'generada') {
                      <td class="px-4 py-3">
                        <button type="button" (click)="quitarFactura(fac)" [disabled]="actionBusy()"
                                [disabledIfNoPermission]="'planillas.generar'"
                                class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50">
                          Quitar
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="planilla()!.estado === 'generada' ? 3 : 2"
                        class="px-4 py-5 text-center text-sm text-forest-500">
                      Sin pre facturas vinculadas.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Documentos -->
        @for (doc of planilla()!.documentos; track doc.id_planilla_sap_documento) {
          <div class="mt-5 rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-forest-900">
                  Documento #{{ doc.numero_documento }}
                </h2>
                <p class="text-xs text-forest-500">
                  CC: {{ doc.centro_costo_codigo || '-' }} · Cta Mayor: {{ doc.cuenta_mayor_codigo || '-' }}
                </p>
              </div>
              <span class="rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
                {{ doc.total_lineas }} líneas · {{ formatCLP(doc.monto_debito) }}
              </span>
            </div>

            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-3 py-2">#</th>
                    <th class="px-3 py-2">Tipo</th>
                    <th class="px-3 py-2">Cta / Proveedor</th>
                    <th class="px-3 py-2">Centro Costo</th>
                    <th class="px-3 py-2">OC</th>
                    <th class="px-3 py-2">Asignación</th>
                    <th class="px-3 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @for (linea of doc.lineas; track linea.id_planilla_sap_linea) {
                    @if (linea.importe !== 0) {
                    <tr [class.bg-forest-50]="linea.es_doc_nuevo" [class.font-semibold]="linea.es_doc_nuevo">
                      <td class="px-3 py-2 text-forest-500">{{ linea.numero_linea }}</td>
                      <td class="px-3 py-2">
                        @if (linea.clave_contabilizacion === '50') {
                          <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DÉBITO</span>
                        } @else {
                          <span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">CRÉDITO</span>
                        }
                      </td>
                      <td class="px-3 py-2 text-forest-800">
                        {{ linea.cuenta_mayor || linea.codigo_proveedor || '-' }}
                      </td>
                      <td class="px-3 py-2 text-forest-600">{{ linea.centro_costo || '' }}</td>
                      <td class="px-3 py-2 text-forest-600">
                        @if (planilla()!.estado === 'generada' && linea.clave_contabilizacion === '29') {
                          <div class="flex items-center gap-1">
                            <input type="text" [(ngModel)]="linea.orden_compra"
                              (ngModelChange)="ocDirty.set(true)"
                              placeholder="OC" class="w-24 rounded border border-forest-200 px-1.5 py-0.5 text-xs" />
                            <span class="text-forest-400">/</span>
                            <input type="text" [(ngModel)]="linea.posicion_oc"
                              (ngModelChange)="ocDirty.set(true)"
                              placeholder="10" class="w-14 rounded border border-forest-200 px-1.5 py-0.5 text-xs" />
                          </div>
                        } @else if (linea.orden_compra) {
                          {{ linea.orden_compra }}/{{ linea.posicion_oc }}
                        }
                      </td>
                      <td class="px-3 py-2 text-forest-600">{{ linea.nro_asignacion || '' }}</td>
                      <td class="px-3 py-2 text-right" [class.text-red-700]="linea.importe < 0"
                          [class.text-forest-900]="linea.importe >= 0">
                        {{ formatCLP(linea.importe) }}
                      </td>
                    </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <!-- Guardar OC -->
      @if (planilla()?.estado === 'generada' && ocDirty()) {
        <div class="mt-4 flex items-center justify-end gap-3">
          @if (ocSaveMsg()) {
            <span class="text-xs text-green-700">{{ ocSaveMsg() }}</span>
          }
          <button type="button" (click)="guardarOrdenesCompra()" [disabled]="actionBusy()"
                  [disabledIfNoPermission]="'planillas.generar'"
                  class="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50 transition">
            {{ actionBusy() ? 'Guardando...' : 'Guardar Órdenes de Compra' }}
          </button>
        </div>
      }

      <!-- Modal asignar OC al agregar prefacturas -->
      @if (showAgregarOcModal()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div class="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
                 style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
              <div>
                <h2 class="text-lg font-bold text-white">Asignar Órdenes de Compra</h2>
                <p class="text-xs text-green-200 mt-0.5">Pre factura {{ agregarFacturaNumero() }}</p>
              </div>
              <button type="button" (click)="cancelarAgregarOc()" class="text-white/70 hover:text-white transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="px-6 py-6 space-y-5">
              @if (agregarOcLoading()) {
                <div class="flex items-center justify-center py-8">
                  <svg class="animate-spin w-6 h-6 text-forest-400" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              } @else if (agregarOcProductores().length === 0) {
                <p class="text-sm text-forest-500 text-center py-4">No se encontraron movimientos.</p>
              } @else {
                <div class="rounded-xl border border-forest-100 overflow-hidden">
                  <table class="min-w-full table-fixed">
                    <colgroup>
                      <col class="w-[100px]" />
                      <col class="w-auto" />
                      <col class="w-[90px]" />
                      <col class="w-[110px]" />
                      <col class="w-[220px]" />
                      <col class="w-[90px]" />
                    </colgroup>
                    <thead>
                      <tr class="bg-forest-50 border-b border-forest-100">
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Código</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Nombre</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-forest-600">Monto</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Especie</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Orden de Compra</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-forest-600">Pos OC</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-forest-50">
                      @for (prod of agregarOcProductores(); track prod.id_productor + '|' + prod.especie) {
                        <tr class="hover:bg-forest-50/50 transition-colors">
                          <td class="px-3 py-2 text-sm font-mono text-forest-700">{{ prod.codigo_proveedor || 'SIN CÓDIGO' }}</td>
                          <td class="px-3 py-2 text-sm text-forest-900">{{ prod.nombre }}</td>
                          <td class="px-3 py-2 text-sm text-forest-900 text-right font-semibold">{{ formatCLP(prod.monto) }}</td>
                          <td class="px-3 py-2 text-sm text-forest-700">{{ prod.especie || '-' }}</td>
                          <td class="px-3 py-2">
                            @if (isLoadingAgregarOrdenes(prod.id_productor)) {
                              <span class="text-xs text-forest-400">Cargando OC...</span>
                            } @else if (getAgregarOcOptions(prod.id_productor).length > 0) {
                              <app-searchable-combobox
                                placeholder="Buscar OC..."
                                nullLabel="Sin OC"
                                [allowFreeText]="true"
                                [options]="getAgregarOcOptions(prod.id_productor)"
                                [value]="prod.orden_compra"
                                (valueChange)="onAgregarOcChange(prod, $event)"
                              />
                            } @else {
                              <input type="text" [(ngModel)]="prod.orden_compra" placeholder="OC"
                                class="cfl-input text-sm" />
                            }
                          </td>
                          <td class="px-3 py-2">
                            @if (getAgregarPosOptions(prod).length > 0) {
                              <app-searchable-combobox
                                placeholder="Pos..."
                                nullLabel="Sin pos"
                                [allowFreeText]="true"
                                [options]="getAgregarPosOptions(prod)"
                                [value]="prod.posicion_oc"
                                (valueChange)="prod.posicion_oc = $event"
                              />
                            } @else {
                              <input type="text" [(ngModel)]="prod.posicion_oc" placeholder="10"
                                class="cfl-input text-sm w-20" />
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              @if (agregarOcError()) {
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p class="text-sm text-red-700">{{ agregarOcError() }}</p>
                </div>
              }
            </div>

            <div class="sticky bottom-0 flex items-center justify-end gap-3 border-t border-forest-100 bg-white px-6 py-4">
              <button type="button" (click)="cancelarAgregarOc()" [disabled]="agregarOcSubmitting()"
                class="rounded-lg border border-forest-200 bg-white px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50 transition">
                Cancelar
              </button>
              <button type="button" (click)="confirmarAgregarConOc()" [disabled]="agregarOcSubmitting() || agregarOcLoading()"
                [disabledIfNoPermission]="'planillas.generar'"
                class="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50 transition">
                {{ agregarOcSubmitting() ? 'Agregando...' : 'Agregar Pre Factura' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal confirmación envío -->
      @if (showConfirmEnvio()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-forest-900">Marcar como enviada</h3>
            <p class="mt-2 text-sm text-forest-600">
              Una vez enviada, la planilla no podrá ser modificada. ¿Continuar?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmEnvio.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="marcarEnviada()" [disabled]="actionBusy()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {{ actionBusy() ? 'Procesando...' : 'Confirmar envío' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal confirmación anulación -->
      @if (showConfirmAnular()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-red-800">Anular planilla</h3>
            <p class="mt-2 text-sm text-forest-600">
              Las pre facturas incluidas quedarán disponibles para generar otra planilla. ¿Continuar?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmAnular.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="anularPlanilla()" [disabled]="actionBusy()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {{ actionBusy() ? 'Anulando...' : 'Anular planilla' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal confirmación quitar pre factura -->
      @if (showConfirmQuitar()) {
        <div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-base font-semibold text-red-800">Quitar pre factura</h3>
            <p class="mt-2 text-sm text-forest-600">
              ¿Quitar la pre factura <span class="font-semibold text-forest-900">{{ quitarFacturaTarget()?.numero_factura }}</span> de esta planilla?
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" (click)="showConfirmQuitar.set(false)"
                      class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
                Cancelar
              </button>
              <button type="button" (click)="confirmarQuitar()" [disabled]="actionBusy()"
                      [disabledIfNoPermission]="'planillas.generar'"
                      class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {{ actionBusy() ? 'Quitando...' : 'Quitar' }}
              </button>
            </div>
          </div>
        </div>
      }

    </app-workspace-shell>
  `
})
export class PlanillaDetalleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly loading     = signal(false);
  readonly error       = signal('');
  readonly actionError = signal('');
  readonly actionBusy  = signal(false);
  readonly planilla    = signal<PlanillaSapDetalle | null>(null);

  // Agregar pre facturas
  readonly showAgregarPanel  = signal(false);
  readonly loadingElegibles  = signal(false);
  readonly facturasElegibles = signal<FacturaElegible[]>([]);

  // OC editing
  readonly ocDirty   = signal(false);
  readonly ocSaveMsg = signal('');

  // Agregar con OC modal
  readonly showAgregarOcModal    = signal(false);
  readonly agregarOcLoading      = signal(false);
  readonly agregarOcSubmitting   = signal(false);
  readonly agregarOcError        = signal('');
  readonly agregarOcProductores  = signal<AgregarProductorOc[]>([]);
  readonly agregarFacturaId      = signal(0);
  readonly agregarFacturaNumero  = signal('');
  readonly agregarOrdenesPorProd = signal<Map<number, OrdenCompraOption[]>>(new Map());
  readonly agregarLoadingOrdenes = signal<Set<number>>(new Set());

  // Modals
  readonly showConfirmEnvio   = signal(false);
  readonly showConfirmAnular  = signal(false);
  readonly showConfirmQuitar  = signal(false);
  readonly quitarFacturaTarget = signal<PlanillaSapFacturaVinculada | null>(null);

  private idPlanilla = 0;

  constructor(
    private cflApi: CflApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.idPlanilla = Number(this.route.snapshot.paramMap.get('id')) || 0;
    if (!this.idPlanilla) { this.router.navigate(['/planillas-sap']); return; }
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set('');
    this.cflApi.getPlanillaSapDetalle(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.planilla.set(res.data); this.loading.set(false); },
        error: (err) => { this.error.set(err?.error?.error ?? 'No se pudo cargar la planilla.'); this.loading.set(false); },
      });
  }

  descargar(): void {
    this.cflApi.exportarPlanillaSap(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const label = (this.planilla()?.periodo_label || String(this.idPlanilla)).replace(/\s+/g, '-');
          triggerDownload(blob, `planilla-sap-${label}.xlsx`);
        },
        error: () => this.actionError.set('Error al descargar el archivo.'),
      });
  }

  // --- Agregar pre facturas ---

  toggleAgregarPanel(): void {
    const open = !this.showAgregarPanel();
    this.showAgregarPanel.set(open);
    if (open) this.loadElegibles();
  }

  private loadElegibles(): void {
    this.loadingElegibles.set(true);
    this.cflApi.getPlanillaFacturasElegibles(this.idPlanilla)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.facturasElegibles.set((res.data || []) as unknown as FacturaElegible[]);
          this.loadingElegibles.set(false);
        },
        error: () => {
          this.facturasElegibles.set([]);
          this.loadingElegibles.set(false);
        },
      });
  }

  agregarFactura(fac: FacturaElegible): void {
    this.agregarFacturaId.set(fac.id_factura);
    this.agregarFacturaNumero.set(fac.numero_factura);
    this.agregarOcProductores.set([]);
    this.agregarOrdenesPorProd.set(new Map());
    this.agregarLoadingOrdenes.set(new Set());
    this.agregarOcError.set('');
    this.agregarOcSubmitting.set(false);
    this.showAgregarOcModal.set(true);
    this.loadAgregarMovimientos(fac.id_factura);
  }

  cancelarAgregarOc(): void {
    this.showAgregarOcModal.set(false);
  }

  confirmarAgregarConOc(): void {
    this.agregarOcSubmitting.set(true);
    this.agregarOcError.set('');

    const productoresOc = this.agregarOcProductores()
      .filter(p => p.orden_compra)
      .map(p => ({
        id_productor: p.id_productor,
        especie: p.especie || undefined,
        orden_compra: p.orden_compra,
        posicion_oc: p.posicion_oc || undefined,
      }));

    this.cflApi.agregarFacturasPlanilla(this.idPlanilla, [this.agregarFacturaId()], productoresOc)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.agregarOcSubmitting.set(false);
          this.showAgregarOcModal.set(false);
          this.loadData();
          this.loadElegibles();
        },
        error: (err) => {
          this.agregarOcSubmitting.set(false);
          this.agregarOcError.set(err?.error?.error ?? 'Error al agregar pre factura.');
        },
      });
  }

  onAgregarOcChange(prod: AgregarProductorOc, ebeln: string): void {
    prod.orden_compra = ebeln;
    const ordenes = this.agregarOrdenesPorProd().get(prod.id_productor) || [];
    const selected = ordenes.find(o => o.ebeln === ebeln);
    if (selected?.posiciones?.length) {
      prod.posicion_oc = this._trimLeadingZeros(selected.posiciones[0].ebelp);
    }
  }

  isLoadingAgregarOrdenes(idProductor: number): boolean {
    return this.agregarLoadingOrdenes().has(idProductor);
  }

  getAgregarOcOptions(idProductor: number): SearchableOption[] {
    return (this.agregarOrdenesPorProd().get(idProductor) || []).map(oc => ({
      value: oc.ebeln,
      label: this._formatOcLabel(oc),
    }));
  }

  getAgregarPosOptions(prod: AgregarProductorOc): SearchableOption[] {
    const ordenes = this.agregarOrdenesPorProd().get(prod.id_productor) || [];
    const selected = ordenes.find(o => o.ebeln === prod.orden_compra);
    return (selected?.posiciones || []).map(pos => ({
      value: this._trimLeadingZeros(pos.ebelp),
      label: this._formatPosLabel(pos),
    }));
  }

  private loadAgregarMovimientos(idFactura: number): void {
    this.agregarOcLoading.set(true);
    this.cflApi.getPlanillaMovimientos([idFactura])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows: MovimientoPlanillaRow[] = res.data || [];
          const grouped = new Map<string, AgregarProductorOc>();
          for (const m of rows) {
            if (!m.id_productor) continue;
            const especie = m.especie_nombre || '';
            const key = `${m.id_productor}|${especie}`;
            const existing = grouped.get(key);
            if (existing) {
              existing.monto += m.monto_aplicado || 0;
            } else {
              grouped.set(key, {
                id_productor: m.id_productor,
                codigo_proveedor: m.codigo_proveedor || '',
                nombre: m.productor_nombre || '',
                monto: m.monto_aplicado || 0,
                especie,
                orden_compra: '',
                posicion_oc: '10',
              });
            }
          }
          const prods = Array.from(grouped.values()).sort((a, b) =>
            a.codigo_proveedor.localeCompare(b.codigo_proveedor)
          );
          this.agregarOcProductores.set(prods);
          this.agregarOcLoading.set(false);
          this._loadAgregarOcForAll(prods);
        },
        error: () => {
          this.agregarOcLoading.set(false);
          this.agregarOcError.set('No se pudieron cargar los movimientos.');
        },
      });
  }

  private _loadAgregarOcForAll(prods: AgregarProductorOc[]): void {
    for (const prod of prods) {
      if (!prod.codigo_proveedor || this.agregarOrdenesPorProd().has(prod.id_productor)) continue;
      const loading = new Set(this.agregarLoadingOrdenes());
      loading.add(prod.id_productor);
      this.agregarLoadingOrdenes.set(loading);

      this.cflApi.getOrdenesCompraProveedor(prod.codigo_proveedor)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const map = new Map(this.agregarOrdenesPorProd());
            map.set(prod.id_productor, res.data.ordenes || []);
            this.agregarOrdenesPorProd.set(map);
            const l = new Set(this.agregarLoadingOrdenes());
            l.delete(prod.id_productor);
            this.agregarLoadingOrdenes.set(l);
          },
          error: () => {
            const map = new Map(this.agregarOrdenesPorProd());
            map.set(prod.id_productor, []);
            this.agregarOrdenesPorProd.set(map);
            const l = new Set(this.agregarLoadingOrdenes());
            l.delete(prod.id_productor);
            this.agregarLoadingOrdenes.set(l);
          },
        });
    }
  }

  private _formatOcLabel(oc: OrdenCompraOption): string {
    const fecha = this._formatSapDate(oc.aedat);
    const especies = oc.posiciones.map(p => p.txz01).filter(Boolean);
    let hint = '';
    if (especies.length > 0) {
      const joined = [...new Set(especies)].join(', ');
      hint = joined.length > 30 ? ` [${joined.slice(0, 30)}…]` : ` [${joined}]`;
    }
    return `${oc.ebeln} — ${fecha}${hint}`;
  }

  private _formatPosLabel(pos: { ebelp: string; matnr: string; txz01: string }): string {
    const posNum = this._trimLeadingZeros(pos.ebelp);
    let desc = pos.txz01 || pos.matnr || '';
    if (desc.length > 30) desc = desc.slice(0, 30) + '…';
    return desc ? `${posNum} — ${desc}` : posNum;
  }

  private _trimLeadingZeros(value: string): string {
    const trimmed = value.replace(/^0+/, '');
    return trimmed || '0';
  }

  private _formatSapDate(sapDate: string): string {
    if (!sapDate || sapDate.length !== 8) return sapDate;
    return `${sapDate.slice(6, 8)}/${sapDate.slice(4, 6)}/${sapDate.slice(0, 4)}`;
  }

  // --- Quitar pre factura ---

  quitarFactura(fac: PlanillaSapFacturaVinculada): void {
    this.quitarFacturaTarget.set(fac);
    this.showConfirmQuitar.set(true);
  }

  confirmarQuitar(): void {
    const fac = this.quitarFacturaTarget();
    if (!fac) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    this.showConfirmQuitar.set(false);
    this.cflApi.quitarFacturaPlanilla(this.idPlanilla, fac.id_factura)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.loadData();
          if (this.showAgregarPanel()) this.loadElegibles();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al quitar pre factura.');
        },
      });
  }

  // --- Enviar ---

  confirmarEnvio(): void { this.showConfirmEnvio.set(true); }

  marcarEnviada(): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.cambiarEstadoPlanilla(this.idPlanilla, 'enviada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.showConfirmEnvio.set(false);
          this.loadData();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al marcar como enviada.');
        },
      });
  }

  // --- Anular ---

  confirmarAnulacion(): void { this.showConfirmAnular.set(true); }

  anularPlanilla(): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.cflApi.cambiarEstadoPlanilla(this.idPlanilla, 'anulada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.showConfirmAnular.set(false);
          this.loadData();
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al anular la planilla.');
        },
      });
  }

  // --- Guardar OC ---

  guardarOrdenesCompra(): void {
    const p = this.planilla();
    if (!p) return;

    const lineas: { id_linea: number; orden_compra: string; posicion_oc: string }[] = [];
    for (const doc of p.documentos) {
      for (const linea of doc.lineas) {
        if (linea.clave_contabilizacion === '29') {
          lineas.push({
            id_linea: linea.id_planilla_sap_linea,
            orden_compra: linea.orden_compra || '',
            posicion_oc: linea.posicion_oc || '10',
          });
        }
      }
    }

    if (lineas.length === 0) return;

    this.actionBusy.set(true);
    this.actionError.set('');
    this.ocSaveMsg.set('');

    this.cflApi.actualizarOrdenesCompraPlanilla(p.id_planilla_sap, lineas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.ocDirty.set(false);
          this.ocSaveMsg.set('Guardado correctamente');
          setTimeout(() => this.ocSaveMsg.set(''), 3000);
        },
        error: (err) => {
          this.actionBusy.set(false);
          this.actionError.set(err?.error?.error ?? 'Error al guardar órdenes de compra.');
        },
      });
  }

  estadoLabel(estado: string): string { return ESTADO_LABELS[estado] ?? estado; }
  estadoChip(estado: string): string { return ESTADO_CHIP[estado] ?? 'bg-slate-100 text-slate-700'; }
  readonly formatCLP  = formatCLP;
  readonly formatDate = formatDate;
}
