import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-base font-semibold" [class]="titleClass()">{{ title() }}</h3>
          <p class="mt-2 text-sm text-forest-600">
            <ng-content></ng-content>
          </p>
          <div class="mt-4 flex justify-end gap-3">
            <button type="button"
                    (click)="cancel.emit()"
                    class="rounded-xl border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50">
              {{ cancelLabel() }}
            </button>
            <button type="button"
                    (click)="confirm.emit()"
                    [disabled]="loading()"
                    class="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    [class]="confirmClass()">
              {{ loading() ? loadingLabel() : confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input('Confirmar acción');
  readonly titleClass = input('text-forest-900');
  readonly cancelLabel = input('Cancelar');
  readonly confirmLabel = input('Confirmar');
  readonly loadingLabel = input('Procesando...');
  readonly confirmClass = input('bg-red-600 hover:bg-red-700');
  readonly loading = input(false);

  readonly cancel = output();
  readonly confirm = output();
}
