import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
} from '@angular/core';
import { AuthzService } from '../services/authz.service';

/**
 * Deshabilita un elemento y muestra un tooltip cuando el usuario no tiene
 * el permiso requerido. Acepta un solo permiso o un arreglo (OR).
 *
 * Uso:
 *   <button [disabledIfNoPermission]="'fletes.crear'">Crear</button>
 *   <button [disabledIfNoPermission]="['fletes.crear', 'fletes.editar']">Accion</button>
 */
@Directive({
  selector: '[disabledIfNoPermission]',
  standalone: true,
})
export class DisabledIfNoPermissionDirective {
  private readonly authz = inject(AuthzService);
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  readonly disabledIfNoPermission = input.required<string | string[]>();
  readonly disabledTooltip = input('No tienes permisos para esta accion');

  constructor() {
    effect(() => {
      const perms = this.authz.permissions();
      const tooltip = this.disabledTooltip();
      const value = this.disabledIfNoPermission();

      const keys = Array.isArray(value) ? value : [value];
      const allowed = keys.some((k) => perms.has(k));
      const native = this.el.nativeElement;

      if (allowed) {
        this.renderer.removeAttribute(native, 'disabled');
        this.renderer.removeAttribute(native, 'title');
        this.renderer.removeClass(native, 'cursor-not-allowed');
        this.renderer.removeClass(native, 'opacity-50');
      } else {
        this.renderer.setAttribute(native, 'disabled', 'true');
        this.renderer.setAttribute(native, 'title', tooltip);
        this.renderer.addClass(native, 'cursor-not-allowed');
        this.renderer.addClass(native, 'opacity-50');
      }
    });
  }
}
