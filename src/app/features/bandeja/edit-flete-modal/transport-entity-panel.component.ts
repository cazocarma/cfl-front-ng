import { ChangeDetectionStrategy, Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SearchableComboboxComponent, SearchableOption } from '../searchable-combobox.component';
import {
  CamionDraft,
  ChoferDraft,
  EmpresaTransporteDraft,
  EntityResolution,
  TipoCamionChangePlan,
} from './transport-entity-state';
import { isValidChileanRut } from '../../../core/validators/rut.validator';

export type TransportEntityKey = 'empresa' | 'chofer' | 'camion';

// Forma generica de resolution para evitar union-type hell en el template.
type AnyDraft = EmpresaTransporteDraft | ChoferDraft | CamionDraft;
type AnyResolution = EntityResolution<AnyDraft>;

@Component({
  selector: 'app-transport-entity-panel',
  standalone: true,
  imports: [FormsModule, SearchableComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1.5">
      <!-- Combobox (existente, con label) -->
      <app-searchable-combobox
        [label]="label"
        [nullLabel]="'Sin especificar'"
        [disabled]="disabled"
        [options]="options"
        [value]="selectedValueStr()"
        (valueChange)="onComboboxValueChange($event)"
      />

      <!-- Placa de estado + toggle de edición -->
      @if (resolution && resolution.mode !== 'empty') {
        <div
          class="rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center gap-2"
          [class]="placaClass()"
        >
          <span class="font-semibold">{{ placaTitle() }}</span>
          @if (resolution.hint) {
            <span class="text-forest-500">·</span>
            <span class="text-forest-600 font-mono text-[11px] truncate max-w-[260px]">{{ resolution.hint }}</span>
          }

          <span class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class="text-[11px] font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
              [disabled]="disabled || (!canEditMantenedor && (resolution.mode === 'pending_create' || resolution.mode === 'update'))"
              (click)="togglePanel()"
            >
              {{ expanded() ? 'Cerrar' : 'Editar datos' }}
            </button>
          </span>
        </div>
      }

      <!-- Permisos insuficientes -->
      @if (resolution && resolution.mode === 'pending_create' && !canEditMantenedor) {
        <p class="text-[11px] text-red-600 italic">
          No tienes permiso para crear {{ entityLabel() }} en el mantenedor. Pide a un administrador que lo registre antes de guardar.
        </p>
      }

      <!-- Panel expandible con mini-formulario -->
      @if (expanded()) {
        <div class="rounded-xl border border-forest-200 bg-white p-3 space-y-2">
          @switch (entityKey) {
            @case ('empresa') {
              <div class="flex flex-col gap-2">
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <label class="text-[11px] font-semibold text-forest-700">Código SAP</label>
                    @if (isKeyFieldLocked()) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-normal text-forest-500 whitespace-nowrap" title="No editable: es el enlace con SAP">
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                        </svg>
                        enlace SAP
                      </span>
                    }
                  </div>
                  <input type="text" class="cfl-input text-sm font-mono w-full"
                    [class.bg-slate-100]="isKeyFieldLocked()"
                    [class.cursor-not-allowed]="isKeyFieldLocked()"
                    [disabled]="disabled || isKeyFieldLocked()"
                    [ngModel]="draftString('sap_codigo')"
                    (ngModelChange)="onDraftField('sap_codigo', $event)" />
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">RUT</label>
                  <input type="text" class="cfl-input text-sm w-full"
                    [class.border-amber-400]="!isRutValid()"
                    [class.bg-amber-50]="!isRutValid()"
                    [disabled]="disabled"
                    [ngModel]="draftString('rut')"
                    (ngModelChange)="onDraftField('rut', $event)" />
                  @if (!isRutValid()) {
                    <p class="text-[10px] text-amber-700 mt-0.5">RUT inválido (revisa el dígito verificador). Puedes guardar igual.</p>
                  }
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Razón Social</label>
                  <input type="text" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('razon_social')"
                    (ngModelChange)="onDraftField('razon_social', $event)" />
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Representante</label>
                  <input type="text" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('nombre_representante')"
                    (ngModelChange)="onDraftField('nombre_representante', $event)" />
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Correo</label>
                  <input type="email" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('correo')"
                    (ngModelChange)="onDraftField('correo', $event)" />
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Teléfono</label>
                  <input type="text" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('telefono')"
                    (ngModelChange)="onDraftField('telefono', $event)" />
                </div>
              </div>
            }
            @case ('chofer') {
              <div class="flex flex-col gap-2">
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <label class="text-[11px] font-semibold text-forest-700">ID Fiscal (RUT) <span class="required-mark">*</span></label>
                    @if (isKeyFieldLocked()) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-normal text-forest-500 whitespace-nowrap" title="No editable: es el enlace con SAP/Romana">
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                        </svg>
                        enlace SAP
                      </span>
                    }
                  </div>
                  <input type="text" class="cfl-input text-sm font-mono w-full"
                    [class.border-red-500]="!isRutValid()"
                    [class.bg-slate-100]="isKeyFieldLocked()"
                    [class.cursor-not-allowed]="isKeyFieldLocked()"
                    [disabled]="disabled || isKeyFieldLocked()"
                    [ngModel]="draftString('sap_id_fiscal')"
                    (ngModelChange)="onDraftField('sap_id_fiscal', $event)" />
                  @if (!isRutValid()) {
                    <p class="text-[10px] text-red-500 mt-0.5">RUT inválido (revisa el dígito verificador).</p>
                  }
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Nombre completo <span class="required-mark">*</span></label>
                  <input type="text" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('sap_nombre')"
                    (ngModelChange)="onDraftField('sap_nombre', $event)" />
                </div>
                <div class="min-w-0">
                  <label class="block text-[11px] font-semibold text-forest-700 mb-0.5">Teléfono</label>
                  <input type="text" class="cfl-input text-sm w-full" [disabled]="disabled"
                    [ngModel]="draftString('telefono')"
                    (ngModelChange)="onDraftField('telefono', $event)" />
                </div>
              </div>
            }
            @case ('camion') {
              <div class="flex flex-col gap-2">
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <label class="text-[11px] font-semibold text-forest-700">Patente <span class="required-mark">*</span></label>
                    @if (isKeyFieldLocked()) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-normal text-forest-500 whitespace-nowrap" title="No editable: es el enlace con SAP/Romana">
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                        </svg>
                        enlace SAP
                      </span>
                    }
                  </div>
                  <input type="text" class="cfl-input text-sm font-mono w-full"
                    [class.bg-slate-100]="isKeyFieldLocked()"
                    [class.cursor-not-allowed]="isKeyFieldLocked()"
                    [disabled]="disabled || isKeyFieldLocked()"
                    [ngModel]="draftString('sap_patente')"
                    (ngModelChange)="onDraftField('sap_patente', $event.toUpperCase())" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <label class="text-[11px] font-semibold text-forest-700">Carro</label>
                    @if (isKeyFieldLocked()) {
                      <span class="inline-flex items-center gap-1 text-[10px] font-normal text-forest-500 whitespace-nowrap" title="No editable: es el enlace con SAP/Romana">
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                        </svg>
                        enlace SAP
                      </span>
                    }
                  </div>
                  <input type="text" class="cfl-input text-sm font-mono w-full"
                    [class.bg-slate-100]="isKeyFieldLocked()"
                    [class.cursor-not-allowed]="isKeyFieldLocked()"
                    [disabled]="disabled || isKeyFieldLocked()"
                    [ngModel]="draftString('sap_carro')"
                    (ngModelChange)="onDraftField('sap_carro', $event.toUpperCase())" />
                </div>
                <div class="min-w-0">
                  <app-searchable-combobox
                    label="Tipo de camión"
                    nullLabel="Sin tipo"
                    [disabled]="disabled"
                    [options]="tipoCamionOptions"
                    [value]="camionTipoValue()"
                    (valueChange)="onCamionTipoChange($event)"
                  />
                </div>
              </div>

              <!-- Warning + confirm cuando el tipo cambia sobre un camión existente -->
              @if (camionTipoChange && camionTipoChange.changed && resolution?.mode === 'matched') {
                <div class="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 mt-2">
                  <p class="text-xs text-amber-900 font-semibold">
                    ⚠ Vas a cambiar el tipo del camión seleccionado en el mantenedor.
                  </p>
                  <p class="text-[11px] text-amber-800 mt-1">
                    Esto afectará futuros fletes que usen este camión. Los fletes históricos no se tocan.
                  </p>
                  <label class="mt-2 flex items-center gap-2 text-[11px] text-amber-900">
                    <input type="checkbox"
                      [disabled]="disabled"
                      [checked]="camionTipoChange.confirmed"
                      (change)="onTipoCamionConfirmChange($any($event.target).checked)" />
                    <span class="font-semibold">Confirmo actualizar el camión en el mantenedor.</span>
                  </label>
                </div>
              }
            }
          }
        </div>
      }
    </div>
  `,
})
export class TransportEntityPanelComponent {
  @Input() entityKey!: TransportEntityKey;
  @Input() label = '';
  @Input() options: SearchableOption[] = [];
  @Input() tipoCamionOptions: SearchableOption[] = [];
  @Input() resolution: AnyResolution | null = null;
  @Input() camionTipoChange: TipoCamionChangePlan | null = null;
  @Input() disabled = false;
  @Input() canEditMantenedor = true;

  @Output() selectExisting = new EventEmitter<number | null>();
  @Output() draftFieldChange = new EventEmitter<{ field: string; value: unknown }>();
  @Output() tipoCamionValueChange = new EventEmitter<number | null>();
  @Output() tipoCamionConfirmChange = new EventEmitter<boolean>();

  expanded = signal(false);

  entityLabel = computed<string>(() => {
    switch (this.entityKey) {
      case 'empresa': return 'empresas de transporte';
      case 'chofer': return 'choferes';
      case 'camion': return 'camiones';
      default: return '';
    }
  });

  selectedValueStr(): string {
    return this.resolution?.existingId ? String(this.resolution.existingId) : '';
  }

  camionTipoValue(): string {
    const tipo = (this.resolution?.draft as CamionDraft | undefined)?.id_tipo_camion;
    return tipo ? String(tipo) : '';
  }

  draftString(field: string): string {
    const draft = this.resolution?.draft as unknown as Record<string, unknown> | undefined;
    if (!draft) return '';
    const v = draft[field];
    return v === null || v === undefined ? '' : String(v);
  }

  placaTitle(): string {
    if (!this.resolution) return '';
    switch (this.resolution.mode) {
      case 'pending_create': return '✦ No registrado · se creará al guardar';
      case 'update': return '✎ Se actualizará al guardar';
      case 'matched': return '✓ Seleccionado';
      default: return '';
    }
  }

  placaClass(): string {
    if (!this.resolution) return '';
    switch (this.resolution.mode) {
      case 'pending_create': return 'border-amber-300 bg-amber-50 text-amber-900';
      case 'update': return 'border-emerald-300 bg-emerald-50 text-emerald-900';
      case 'matched': return 'border-sky-200 bg-sky-50 text-sky-900';
      default: return 'border-slate-200 bg-white text-forest-700';
    }
  }

  isRutValid(): boolean {
    if (!this.resolution) return true;
    const field = this.entityKey === 'empresa' ? 'rut' : this.entityKey === 'chofer' ? 'sap_id_fiscal' : null;
    if (!field) return true;
    const value = this.draftString(field);
    if (!value) return true; // vacío tolerado; validadores de required aplican afuera
    return isValidChileanRut(value);
  }

  /**
   * Los campos clave que identifican el registro frente a SAP/Romana (sap_codigo
   * de empresa, sap_id_fiscal de chofer, sap_patente + sap_carro de camión) no
   * deben modificarse si la entidad ya está enlazada (mode=matched | update).
   * Cambiarlos rompería el matching con futuros snapshots SAP/Romana.
   *
   * En mode=pending_create sí son editables porque el usuario puede corregir
   * el hint antes de crear el registro definitivo.
   */
  isKeyFieldLocked(): boolean {
    if (!this.resolution) return false;
    return this.resolution.mode === 'matched' || this.resolution.mode === 'update';
  }

  togglePanel(): void {
    this.expanded.update((v) => !v);
  }

  onComboboxValueChange(value: string): void {
    const id = value ? Number(value) : null;
    this.selectExisting.emit(Number.isFinite(id) ? id : null);
  }

  onDraftField(field: string, value: unknown): void {
    this.draftFieldChange.emit({ field, value });
  }

  onCamionTipoChange(value: string): void {
    const id = value ? Number(value) : null;
    this.tipoCamionValueChange.emit(Number.isFinite(id) ? id : null);
  }

  onTipoCamionConfirmChange(checked: boolean): void {
    this.tipoCamionConfirmChange.emit(checked);
  }
}
