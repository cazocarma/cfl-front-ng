import {
  Component,
  computed,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CflApiService } from '../../../core/services/cfl-api.service';
import { FormsModule } from '@angular/forms';

// Validador: la contraseña debe tener mayúscula, minúscula, número y símbolo
function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const val = control.value as string;
  if (!val) return null; // campo opcional en edición
  const hasUpper  = /[A-Z]/.test(val);
  const hasLower  = /[a-z]/.test(val);
  const hasNumber = /\d/.test(val);
  const hasSymbol = /[^A-Za-z0-9]/.test(val);
  const isLong    = val.length >= 8;
  if (isLong && hasUpper && hasLower && hasNumber && hasSymbol) return null;
  return { passwordWeak: true };
}

// Validador: confirmar que las contraseñas coincidan
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass    = group.get('password')?.value;
  const confirm = group.get('passwordConfirm')?.value;
  if (!pass && !confirm) return null;
  return pass === confirm ? null : { passwordMismatch: true };
}

@Component({
    selector: 'app-usuario-form-modal',
    imports: [ReactiveFormsModule, FormsModule],
    template: `
    @if (visible) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        (click)="onBackdropClick($event)"
      >
        <div
          class="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-forest-100"
               style="background: linear-gradient(160deg, #1e4424 0%, #348040 100%);">
            <div>
              <h2 class="text-lg font-bold text-white">
                {{ row ? 'Editar' : 'Crear' }} Usuario
              </h2>
              <p class="text-xs text-green-200 mt-0.5">
                {{ row ? 'Modifica los datos del usuario' : 'Completa los campos para crear el usuario' }}
              </p>
            </div>
            <button type="button" (click)="cerrado.emit()" class="text-white/70 hover:text-white transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <form [formGroup]="form" (ngSubmit)="onGuardar()" class="px-6 py-6 space-y-5" formGroupName="">

            @if (loadingCatalogos()) {
              <div class="flex justify-center py-12">
                <svg class="animate-spin w-8 h-8 text-forest-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </div>
            } @else {

              <!-- Datos básicos -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="field-label">Username *</label>
                  <input type="text" formControlName="username" class="cfl-input"
                         [class.border-red-400]="fi('username')" placeholder="usuario.apellido" />
                  @if (fi('username')) { <p class="mt-1 text-xs text-red-600">Requerido</p> }
                </div>
                <div>
                  <label class="field-label">Correo electrónico *</label>
                  <input type="email" formControlName="email" class="cfl-input"
                         [class.border-red-400]="fi('email')" placeholder="usuario@empresa.cl" />
                  @if (fi('email')) { <p class="mt-1 text-xs text-red-600">Email inválido o requerido</p> }
                </div>
                <div>
                  <label class="field-label">Nombre</label>
                  <input type="text" formControlName="nombre" class="cfl-input" placeholder="Nombre(s)" />
                </div>
                <div>
                  <label class="field-label">Apellido</label>
                  <input type="text" formControlName="apellido" class="cfl-input" placeholder="Apellido(s)" />
                </div>
              </div>

              <!-- Rol -->
              <div>
                <label class="field-label">Rol *</label>
                <select formControlName="id_rol" class="cfl-select" [class.border-red-400]="fi('id_rol')">
                  <option value="">Seleccionar rol...</option>
                  @for (rol of roles(); track $any(rol)['id_rol']) {
                    <option [value]="$any(rol)['id_rol']">{{ $any(rol)['nombre'] }}</option>
                  }
                </select>
                @if (fi('id_rol')) { <p class="mt-1 text-xs text-red-600">Selecciona un rol</p> }
              </div>

              <!-- Contraseña (requerida en creación, opcional en edición) -->
              <div class="rounded-xl border border-forest-100 bg-forest-50 p-4 space-y-4" [formGroup]="passwordGroup">

                <div class="flex items-center gap-2 mb-1">
                  <svg class="h-4 w-4 text-forest-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <p class="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                    {{ row ? 'Cambiar contraseña (opcional)' : 'Contraseña *' }}
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="field-label">{{ row ? 'Nueva contraseña' : 'Contraseña' }}</label>
                    <div class="relative">
                      <input
                        [type]="showPass() ? 'text' : 'password'"
                        formControlName="password"
                        class="cfl-input pr-10"
                        [class.border-red-400]="passwordGroup.get('password')?.invalid && passwordGroup.get('password')?.touched"
                        placeholder="Mín. 8 chars, mayúscula, número, símbolo"
                      />
                      <button type="button" (click)="toggleShowPass()"
                              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-600">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          @if (!showPass()) {
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          } @else {
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                          }
                        </svg>
                      </button>
                    </div>

                    <!-- Indicador de fortaleza -->
                    @if (passwordValue()) {
                      <div class="mt-2 space-y-1">
                        <div class="flex gap-1">
                          @for (i of [0,1,2,3]; track i) {
                            <div class="flex-1 h-1.5 rounded-full transition-colors"
                                 [class]="i < passwordStrength() ? strengthColor() : 'bg-forest-100'"></div>
                          }
                        </div>
                        <p class="text-xs" [class]="strengthTextColor()">{{ strengthLabel() }}</p>
                        <!-- Requisitos -->
                        <ul class="mt-1.5 space-y-0.5">
                          @for (req of passwordRequirements(); track req.label) {
                            <li class="flex items-center gap-1.5 text-[10px]" [class]="req.met ? 'text-emerald-600' : 'text-forest-400'">
                              <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                @if (req.met) {
                                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                } @else {
                                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"/>
                                }
                              </svg>
                              {{ req.label }}
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>

                  <div>
                    <label class="field-label">Confirmar contraseña</label>
                    <input
                      [type]="showPass() ? 'text' : 'password'"
                      formControlName="passwordConfirm"
                      class="cfl-input"
                      [class.border-red-400]="passwordGroup.hasError('passwordMismatch') && passwordGroup.get('passwordConfirm')?.touched"
                      placeholder="Repetir contraseña"
                    />
                    @if (passwordGroup.hasError('passwordMismatch') && passwordGroup.get('passwordConfirm')?.touched) {
                      <p class="mt-1 text-xs text-red-600">Las contraseñas no coinciden</p>
                    }
                  </div>
                </div>
              </div><!-- /password section -->

              <!-- Error general -->
              @if (errorMsg()) {
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ errorMsg() }}
                </div>
              }

              <!-- Footer -->
              <div class="flex items-center justify-end gap-3 pt-4 border-t border-forest-100">
                <button type="button" (click)="cerrado.emit()" class="btn-secondary">Cancelar</button>
                <button
                  type="submit"
                  [disabled]="!isFormValid() || saving()"
                  class="btn-primary disabled:cursor-not-allowed"
                >
                  @if (saving()) {
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Guardando...
                  } @else {
                    {{ row ? 'Guardar cambios' : 'Crear usuario' }}
                  }
                </button>
              </div>

            }<!-- /else loadingCatalogos -->

          </form>
        </div>
      </div>
    }
  `,
    styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5;
    }
  `]
})
export class UsuarioFormModalComponent implements OnChanges {
  @Input() row: Record<string, unknown> | null = null;
  @Input() visible = false;
  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado  = new EventEmitter<void>();

  form!: FormGroup;
  get passwordGroup(): FormGroup { return this.form.get('pw') as FormGroup; }

  loadingCatalogos = signal(false);
  saving           = signal(false);
  errorMsg         = signal('');
  showPass         = signal(false);

  roles = signal<Record<string, unknown>[]>([]);

  // Computed: fortaleza de contraseña
  passwordValue = computed(() => this.form?.get('pw.password')?.value as string ?? '');

  passwordRequirements = computed(() => {
    const v = this.passwordValue();
    return [
      { label: 'Mínimo 8 caracteres',     met: v.length >= 8 },
      { label: 'Al menos una mayúscula',  met: /[A-Z]/.test(v) },
      { label: 'Al menos una minúscula',  met: /[a-z]/.test(v) },
      { label: 'Al menos un número',      met: /\d/.test(v) },
      { label: 'Al menos un símbolo',     met: /[^A-Za-z0-9]/.test(v) },
    ];
  });

  passwordStrength = computed(() => this.passwordRequirements().filter(r => r.met).length);
  strengthColor    = computed(() => {
    const s = this.passwordStrength();
    if (s <= 2) return 'bg-red-400';
    if (s === 3) return 'bg-amber-400';
    if (s === 4) return 'bg-yellow-400';
    return 'bg-emerald-500';
  });
  strengthTextColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 2) return 'text-red-600';
    if (s <= 3) return 'text-amber-600';
    return 'text-emerald-600';
  });
  strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'Muy débil';
    if (s === 2) return 'Débil';
    if (s === 3) return 'Regular';
    if (s === 4) return 'Buena';
    return 'Muy fuerte';
  });

  constructor(private fb: FormBuilder, private api: CflApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this._buildForm();
      this._loadRoles();
    }
  }

  private _buildForm(): void {
    const isEdit = !!this.row;

    // Contraseña requerida solo al crear
    const passValidators = isEdit
      ? [passwordStrengthValidator]
      : [Validators.required, Validators.minLength(8), passwordStrengthValidator];

    this.form = this.fb.group({
      username: [this.row?.['username'] ?? '', Validators.required],
      email:    [this.row?.['email']    ?? '', [Validators.required, Validators.email]],
      nombre:   [this.row?.['nombre']   ?? ''],
      apellido: [this.row?.['apellido'] ?? ''],
      id_rol:   [this.row?.['id_rol']   ?? '', Validators.required],
      pw: this.fb.group({
        password:        ['', passValidators],
        passwordConfirm: [''],
      }, { validators: passwordMatchValidator }),
    });

    this.errorMsg.set('');
  }

  private _loadRoles(): void {
    this.loadingCatalogos.set(true);

    const req$ = this.row?.['id_usuario']
      ? forkJoin({
          roles:      this.api.listMaintainerRows('roles'),
          userRoles:  this.api.getUserRoles(Number(this.row['id_usuario'])),
        })
      : forkJoin({ roles: this.api.listMaintainerRows('roles') });

    (req$ as ReturnType<typeof forkJoin>).subscribe({
      next: (res: any) => {
        this.roles.set(res['roles'].data as Record<string, unknown>[]);

        // Si estamos editando, pre-seleccionar el primer rol actual del usuario
        if (res['userRoles'] && Array.isArray(res['userRoles'].data) && res['userRoles'].data.length > 0) {
          const primerRol = res['userRoles'].data[0] as Record<string, unknown>;
          this.form.get('id_rol')?.setValue(primerRol['id_rol']);
        }

        this.loadingCatalogos.set(false);
      },
      error: () => { this.loadingCatalogos.set(false); },
    });
  }

  toggleShowPass(): void { this.showPass.set(!this.showPass()); }

  fi(key: string): boolean {
    const ctrl = this.form.get(key);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  isFormValid(): boolean {
    if (this.form.invalid) return false;
    const pwGroup = this.passwordGroup;
    if (pwGroup.hasError('passwordMismatch')) return false;
    // En creación, la contraseña es obligatoria
    if (!this.row && !pwGroup.get('password')?.value) return false;
    return true;
  }

  onGuardar(): void {
    this.form.markAllAsTouched();
    if (!this.isFormValid()) return;

    this.saving.set(true);
    this.errorMsg.set('');

    const v = this.form.value;
    const pwVal = this.passwordGroup.get('password')?.value;

    const body: Record<string, unknown> = {
      username: v['username'],
      email:    v['email'],
      nombre:   v['nombre'] || null,
      apellido: v['apellido'] || null,
      id_rol:   v['id_rol'] || null,
    };

    if (pwVal) body['password'] = pwVal;

    const obs$ = this.row?.['id_usuario']
      ? this.api.updateMaintainerRow('usuarios', Number(this.row['id_usuario']), body)
      : this.api.createMaintainerRow('usuarios', body);

    obs$.subscribe({
      next: () => { this.saving.set(false); this.guardado.emit(); },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Error al guardar el usuario.');
        this.saving.set(false);
      },
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.cerrado.emit();
  }
}
