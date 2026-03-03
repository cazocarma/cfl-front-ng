import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CflApiService } from '../../core/services/cfl-api.service';
import { FleteTabla } from '../../core/models/flete.model';

@Component({
  selector: 'app-edit-flete-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    @if (visible) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="onBackdropClick($event)"
      >
        <!-- Modal panel -->
        <div
          class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <div>
              <h2 class="text-lg font-bold text-white">
                @if (!flete) { Ingreso manual de flete }
                @else if (flete.kind === 'candidato') { Crear flete desde SAP #{{ flete.numeroGuia }} }
                @else { Editar flete #{{ flete.numeroGuia }} }
              </h2>
              <p class="text-xs text-green-200 mt-0.5">Completa todos los campos obligatorios</p>
            </div>
            <button type="button" (click)="cerrado.emit()" class="text-white/70 hover:text-white transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <form [formGroup]="form" (ngSubmit)="onGuardar()" class="px-6 py-6 space-y-5">

            @if (loadingCatalogos()) {
              <div class="flex justify-center py-12">
                <svg class="animate-spin w-8 h-8 text-forest-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            } @else {

            <!-- Fila 1 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Número de guía -->
              <div>
                <label class="field-label">N° Guía / Entrega *</label>
                <input type="text" formControlName="numero_guia" class="cfl-input" placeholder="Ej: 0080012345" />
              </div>
              <!-- Tipo movimiento -->
              <div>
                <label class="field-label">Tipo movimiento *</label>
                <select formControlName="tipo_movimiento" class="cfl-input">
                  <option value="">Seleccionar...</option>
                  <option value="PUSH">Despacho (PUSH)</option>
                  <option value="PULL">Retorno (PULL)</option>
                </select>
              </div>
            </div>

            <!-- Fila 2 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Tipo flete -->
              <div>
                <label class="field-label">Tipo de flete *</label>
                <select formControlName="id_tipo_flete" class="cfl-input">
                  <option value="">Seleccionar...</option>
                  @for (opt of tiposFlete; track opt.id_tipo_flete) {
                    <option [value]="opt.id_tipo_flete">{{ opt.nombre }}</option>
                  }
                </select>
              </div>
              <!-- Centro de costo -->
              <div>
                <label class="field-label">Centro de costo *</label>
                <select formControlName="id_centro_costo" class="cfl-input">
                  <option value="">Seleccionar...</option>
                  @for (opt of centrosCosto; track opt.id_centro_costo) {
                    <option [value]="opt.id_centro_costo">{{ opt.sap_codigo }} — {{ opt.nombre }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Fila 3 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Detalle viaje -->
              <div>
                <label class="field-label">Detalle de viaje</label>
                <select formControlName="id_detalle_viaje" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of detallesViaje; track opt.id_detalle_viaje) {
                    <option [value]="opt.id_detalle_viaje">{{ opt.descripcion }}</option>
                  }
                </select>
              </div>
              <!-- Ruta -->
              <div>
                <label class="field-label">Ruta</label>
                <select formControlName="id_ruta" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of rutas; track opt.id_ruta) {
                    <option [value]="opt.id_ruta">{{ opt.nombre_ruta }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Fila 4: fecha + hora -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="field-label">Fecha salida *</label>
                <input type="date" formControlName="fecha_salida" class="cfl-input" />
              </div>
              <div>
                <label class="field-label">Hora salida *</label>
                <input type="time" formControlName="hora_salida" class="cfl-input" />
              </div>
            </div>

            <!-- Fila 5: empresa + chofer + camión -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="field-label">Empresa transporte</label>
                <select formControlName="id_empresa_transporte" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of empresas; track opt.id_empresa) {
                    <option [value]="opt.id_empresa">{{ opt.razon_social || opt.rut }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="field-label">Chofer</label>
                <select formControlName="id_chofer" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of choferes; track opt.id_chofer) {
                    <option [value]="opt.id_chofer">{{ opt.sap_nombre }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="field-label">Camión</label>
                <select formControlName="id_camion" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of camiones; track opt.id_camion) {
                    <option [value]="opt.id_camion">{{ opt.sap_patente }} / {{ opt.sap_carro }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Fila 6: monto + cuenta mayor -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="field-label">Monto aplicado</label>
                <input type="number" formControlName="monto_aplicado" class="cfl-input" placeholder="0" min="0" step="1" />
              </div>
              <div>
                <label class="field-label">Cuenta mayor</label>
                <select formControlName="id_cuenta_mayor" class="cfl-input">
                  <option value="">Sin especificar</option>
                  @for (opt of cuentasMayor; track opt.id_cuenta_mayor) {
                    <option [value]="opt.id_cuenta_mayor">{{ opt.codigo }} — {{ opt.glosa }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Observaciones -->
            <div>
              <label class="field-label">Observaciones</label>
              <textarea formControlName="observaciones" class="cfl-input min-h-[80px] resize-y" placeholder="Notas adicionales..."></textarea>
            </div>

            <!-- Error -->
            @if (errorMsg()) {
              <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ errorMsg() }}
              </div>
            }

            } <!-- end @else loadingCatalogos -->

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-forest-100">
              <button type="button" (click)="cerrado.emit()" class="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="form.invalid || saving() || loadingCatalogos()"
                class="btn-primary disabled:cursor-not-allowed"
              >
                @if (saving()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Guardando...
                } @else {
                  Guardar flete
                }
              </button>
            </div>

          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5;
    }
  `],
})
export class EditFleteModalComponent implements OnChanges {
  @Input() flete: FleteTabla | null = null;
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado  = new EventEmitter<void>();

  form: FormGroup;
  loadingCatalogos = signal(false);
  saving           = signal(false);
  errorMsg         = signal('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tiposFlete:    any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  centrosCosto:  any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detallesViaje: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rutas:         any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empresas:      any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  choferes:      any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  camiones:      any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cuentasMayor:  any[] = [];

  constructor(private fb: FormBuilder, private cflApi: CflApiService) {
    this.form = this.fb.group({
      numero_guia:          ['', Validators.required],
      tipo_movimiento:      ['', Validators.required],
      id_tipo_flete:        ['', Validators.required],
      id_centro_costo:      ['', Validators.required],
      id_detalle_viaje:     [''],
      id_ruta:              [''],
      fecha_salida:         ['', Validators.required],
      hora_salida:          ['', Validators.required],
      id_empresa_transporte:[''],
      id_chofer:            [''],
      id_camion:            [''],
      monto_aplicado:       [null],
      id_cuenta_mayor:      [''],
      observaciones:        [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.errorMsg.set('');
      this._loadCatalogos();
      this._populateForm();
    }
  }

  private _loadCatalogos(): void {
    this.loadingCatalogos.set(true);
    forkJoin({
      tiposFlete:    this.cflApi.listMaintainerRows('tipos-flete'),
      centrosCosto:  this.cflApi.listMaintainerRows('centros-costo'),
      detallesViaje: this.cflApi.listMaintainerRows('detalles-viaje'),
      rutas:         this.cflApi.listMaintainerRows('rutas'),
      empresas:      this.cflApi.listMaintainerRows('empresas-transporte'),
      choferes:      this.cflApi.listMaintainerRows('choferes'),
      camiones:      this.cflApi.listMaintainerRows('camiones'),
      cuentasMayor:  this.cflApi.listMaintainerRows('cuentas-mayor'),
    }).subscribe({
      next: (res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.tiposFlete    = res.tiposFlete.data    as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.centrosCosto  = res.centrosCosto.data  as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.detallesViaje = res.detallesViaje.data as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.rutas         = res.rutas.data         as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.empresas      = res.empresas.data      as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.choferes      = res.choferes.data      as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.camiones      = res.camiones.data      as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.cuentasMayor  = res.cuentasMayor.data  as any[];
        this.loadingCatalogos.set(false);
      },
      error: () => {
        this.errorMsg.set('Error cargando catálogos. Intenta nuevamente.');
        this.loadingCatalogos.set(false);
      },
    });
  }

  private _populateForm(): void {
    // Reset con valores por defecto; si hay flete en_curso existente, pre-rellena
    this.form.reset({
      numero_guia:           this.flete?.numeroGuia !== '—' ? this.flete?.numeroGuia : '',
      tipo_movimiento:       '',
      id_tipo_flete:         '',
      id_centro_costo:       '',
      id_detalle_viaje:      '',
      id_ruta:               '',
      fecha_salida:          '',
      hora_salida:           '',
      id_empresa_transporte: '',
      id_chofer:             '',
      id_camion:             '',
      monto_aplicado:        this.flete?.monto || null,
      id_cuenta_mayor:       '',
      observaciones:         '',
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) {
      this.cerrado.emit();
    }
  }

  onGuardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');

    const payload = this._buildPayload();

    let obs$;
    if (this.flete?.kind === 'candidato' && this.flete.idSapEntrega) {
      obs$ = this.cflApi.crearCabeceraDesdeCandidato(this.flete.idSapEntrega, payload);
    } else if (this.flete?.kind === 'en_curso' && this.flete.idCabeceraFlete) {
      obs$ = this.cflApi.updateFleteById(this.flete.idCabeceraFlete, payload);
    } else {
      obs$ = this.cflApi.crearFleteManual(payload);
    }

    obs$.subscribe({
      next: () => {
        this.saving.set(false);
        this.guardado.emit();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al guardar el flete.');
        this.saving.set(false);
      },
    });
  }

  private _buildPayload(): Record<string, unknown> {
    const v = this.form.value;
    const payload: Record<string, unknown> = { ...v };
    // Convertir strings vacíos de selects a null
    for (const key of Object.keys(payload)) {
      if (payload[key] === '' || payload[key] === undefined) payload[key] = null;
    }
    return payload;
  }
}
