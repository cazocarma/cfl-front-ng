import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

export type RequirementSeverity = 'error' | 'warn';

export interface RequirementItem {
  id: string;
  label: string;
  done: boolean;
  severity: RequirementSeverity;
  /** Cuando aplica, renderiza un checkbox inline junto al item (uso actual: confirmar tipo camión). */
  action?: { kind: 'checkbox'; checked: boolean };
  /** Texto complementario corto (ej: "Esto afectará futuros fletes"). */
  hint?: string;
}

@Component({
  selector: 'app-save-requirements-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleItems().length > 0) {
      <div
        class="rounded-2xl border shadow-sm"
        [class]="errorCount() > 0
          ? 'border-rose-300 bg-rose-50/80'
          : 'border-amber-300 bg-amber-50/80'"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left"
          (click)="toggle()"
        >
          <span
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            [class]="errorCount() > 0
              ? 'bg-rose-100 text-rose-700'
              : 'bg-amber-100 text-amber-700'"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </span>
          <span class="flex-1 min-w-0">
            <span
              class="block text-sm font-semibold"
              [class]="errorCount() > 0 ? 'text-rose-900' : 'text-amber-900'"
            >
              {{ headerText() }}
            </span>
            <span
              class="block text-[11px]"
              [class]="errorCount() > 0 ? 'text-rose-700' : 'text-amber-700'"
            >
              {{ errorCount() > 0
                ? 'Revisa la lista para saber exactamente qué completar.'
                : 'Puedes guardar igual — son avisos informativos.' }}
            </span>
          </span>
          <svg
            class="h-4 w-4 text-amber-700 transition-transform"
            [class.rotate-180]="collapsed()"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        @if (!collapsed()) {
          <ul class="divide-y divide-amber-200/70 border-t border-amber-200 px-4 py-2">
            @for (item of visibleItems(); track item.id) {
              <li class="flex items-start gap-3 py-2">
                <span
                  class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border"
                  [class]="item.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : (item.severity === 'error' ? 'border-rose-400 bg-white' : 'border-amber-400 bg-white')"
                >
                  @if (item.done) {
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  }
                </span>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-xs font-medium"
                    [class]="item.done
                      ? 'text-forest-400 line-through'
                      : (item.severity === 'error' ? 'text-rose-700' : 'text-amber-800')"
                  >
                    {{ item.label }}
                  </p>
                  @if (item.hint) {
                    <p class="mt-0.5 text-[11px] text-forest-500">{{ item.hint }}</p>
                  }
                  @if (item.action && item.action.kind === 'checkbox' && !item.done) {
                    <label class="mt-1.5 inline-flex items-center gap-2 text-[11px] font-semibold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        class="h-3.5 w-3.5"
                        [checked]="item.action.checked"
                        (change)="onItemCheckbox(item.id, $any($event.target).checked)"
                      />
                      Confirmar
                    </label>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class SaveRequirementsSummaryComponent {
  @Input({ required: true }) set items(value: RequirementItem[]) {
    this._items.set(value ?? []);
  }
  @Output() itemAction = new EventEmitter<{ id: string; kind: 'checkbox'; checked: boolean }>();

  private readonly _items = signal<RequirementItem[]>([]);
  readonly collapsed = signal(false);

  readonly visibleItems = computed<RequirementItem[]>(() => {
    // Mostramos solo pendientes + los que tienen acción inline (checkbox).
    // Los items `done` sin acción se omiten para no saturar.
    return this._items().filter((item) => !item.done || (item.action && item.action.kind === 'checkbox'));
  });

  /** Errores pendientes (bloquean guardado). */
  readonly errorCount = computed<number>(() =>
    this._items().filter((i) => !i.done && i.severity === 'error').length,
  );

  /** Warnings pendientes (solo aviso, no bloquean). */
  readonly warnCount = computed<number>(() =>
    this._items().filter((i) => !i.done && i.severity === 'warn').length,
  );

  readonly headerText = computed<string>(() => {
    const e = this.errorCount();
    const w = this.warnCount();
    if (e > 0 && w > 0) return `Faltan ${e} requisito${e === 1 ? '' : 's'} · ${w} aviso${w === 1 ? '' : 's'}`;
    if (e > 0) return `Faltan ${e} requisito${e === 1 ? '' : 's'} para guardar`;
    if (w > 0) return `${w} aviso${w === 1 ? '' : 's'} para revisar`;
    return '';
  });

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  onItemCheckbox(id: string, checked: boolean): void {
    this.itemAction.emit({ id, kind: 'checkbox', checked });
  }
}
