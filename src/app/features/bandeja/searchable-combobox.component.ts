import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';


export interface SearchableOption {
  value: string;
  label: string;
}

/**
 * Combobox con búsqueda + soporte opcional de texto libre.
 *
 * Invariantes:
 *   1. Con `allowFreeText=true` el `value` ES lo que el usuario tipea: no hay
 *      distinción label/value, y `displayText === value`. Lo emitido en cada
 *      pulsación es literal — el padre decide cómo validarlo.
 *   2. Con `allowFreeText=false` (caso por defecto) el `value` es un ID opaco
 *      y `displayText` muestra el `label` de la opción cuyo `value` coincide.
 *      Si no hay match (opciones aún no hidratadas o value huérfano), fallback
 *      a `String(value)` para no ocultar información al usuario.
 *   3. El `value` emitido nunca es el label: siempre es `option.value` (ID) o
 *      el texto libre. La persistencia del padre no cambia entre modos.
 *   4. `_syncDisplayText` nunca pisa texto que el usuario está tipeando ahora
 *      mismo: sólo resincroniza cuando llegan cambios desde el padre
 *      (value/options) y el foco no está en edición activa.
 */
@Component({
    selector: 'app-searchable-combobox',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgStyle],
    template: `
    <div class="grid gap-2">
      @if (label) {
        <label class="field-label">
          {{ label }}@if (required) {<span class="required-mark">*</span>}
        </label>
      }

      <div class="relative">
        <input
          type="text"
          class="cfl-input pr-8"
          [class.border-red-400]="invalid"
          [placeholder]="placeholder"
          [readOnly]="disabled"
          [value]="displayText"
          (input)="onInput($any($event.target).value)"
          (focus)="openDropdown()"
          (click)="openDropdown()"
          (keydown.escape)="close()"
          autocomplete="off"
        />
        <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-forest-400">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </span>

        @if (isOpen && !disabled) {
          <div class="combobox-dropdown" [ngStyle]="dropdownStyle">
            <button type="button" (mousedown)="selectOption(null)" class="combobox-clear">
              {{ nullLabel }}
            </button>
            @for (opt of filteredOptions(); track opt.value) {
              <button type="button" (mousedown)="selectOption(opt)" class="combobox-item">
                {{ opt.label }}
              </button>
            }
            @if (filteredOptions().length === 0) {
              <p class="combobox-empty">Sin resultados</p>
            }
          </div>
        }
      </div>

      @if (hint) {
        <p class="text-[11px] text-forest-500">{{ hint }}</p>
      }
      @if (invalid) {
        <p class="text-xs font-medium text-red-600">Campo requerido</p>
      }
    </div>
  `,
    styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider;
    }

    .combobox-dropdown {
      position: fixed;
      z-index: 9999;
      overflow-y: auto;
      border-radius: 0.75rem;
      border: 1px solid theme('colors.forest.200');
      background: white;
      box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.15), 0 4px 6px -2px rgb(0 0 0 / 0.08);
    }

    .combobox-clear {
      @apply w-full border-b border-forest-100 px-3 py-2 text-left text-xs text-forest-400 hover:bg-forest-50;
    }

    .combobox-item {
      @apply w-full px-3 py-2 text-left text-xs text-forest-800 hover:bg-forest-50 transition-colors;
    }

    .combobox-empty {
      @apply px-3 py-2 text-xs text-forest-400;
    }
  `]
})
export class SearchableComboboxComponent implements OnChanges, OnDestroy {
  @Input() label = '';
  @Input() placeholder = 'Buscar...';
  @Input() nullLabel = 'Sin seleccionar';
  @Input() required = false;
  @Input() invalid = false;
  @Input() disabled = false;
  @Input() hint = '';
  @Input() allowFreeText = false;
  @Input() options: SearchableOption[] = [];
  @Input() value: string | null = '';
  @Output() valueChange = new EventEmitter<string>();

  readonly searchText = signal('');
  private readonly _options = signal<SearchableOption[]>([]);
  displayText = '';
  isOpen = false;
  dropdownStyle: Record<string, string> = {};

  /**
   * Marcador de que el usuario está editando el input ahora mismo. Mientras
   * esté true, `_syncDisplayText` no pisa `displayText` (eso preservaría el
   * texto tipeado aunque un ngOnChanges dispare un re-sync).
   */
  private _userIsTyping = false;

  readonly filteredOptions = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const opts = this._options();
    if (!query) return opts;
    return opts.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query),
    );
  });

  private _scrollHandler = (event: Event) => {
    if (this._el.nativeElement.contains(event.target as Node)) return;
    this._close();
  };

  private _clickOutsideHandler = (event: MouseEvent) => {
    if (this._el.nativeElement.contains(event.target as Node)) return;
    this._close();
  };

  private readonly _cdr = inject(ChangeDetectorRef);

  constructor(private _el: ElementRef) {}

  ngOnDestroy(): void {
    this._removeGlobalListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this._options.set(this.options);
    }
    if (changes['value'] || changes['options']) {
      this._syncDisplayText();
    }
  }

  onInput(rawValue: string): void {
    this._userIsTyping = true;
    this.searchText.set(rawValue);
    this.displayText = rawValue;

    if (this.allowFreeText) {
      // Cualquier texto se emite literal. Si el usuario selecciona luego una
      // opción, la reemplaza; mientras no lo haga, el padre persiste el texto.
      this.valueChange.emit(rawValue);
    } else if (!rawValue) {
      this.valueChange.emit('');
    }

    if (!this.isOpen) this.openDropdown();
  }

  selectOption(option: SearchableOption | null): void {
    this._userIsTyping = false;
    if (!option) {
      this.searchText.set('');
      this.displayText = '';
      this.valueChange.emit('');
    } else {
      this.displayText = this.allowFreeText ? option.value : option.label;
      this.searchText.set(option.value);
      this.valueChange.emit(option.value);
    }
    this._close();
  }

  openDropdown(): void {
    if (this.disabled || this.isOpen) return;
    this._open();
  }

  close(): void {
    this._close();
  }

  private _open(): void {
    // Al abrir, resetea el filtro para mostrar todas las opciones. El
    // `displayText` NO se toca — así el usuario ve su valor actual mientras
    // elige otra opción.
    this.searchText.set('');
    this._calcPosition();
    this.isOpen = true;
    this._cdr.markForCheck();
    this._addGlobalListeners();
  }

  private _close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._userIsTyping = false;
    this._syncDisplayText();
    this._removeGlobalListeners();
    this._cdr.markForCheck();
  }

  private _calcPosition(): void {
    const input: HTMLElement = this._el.nativeElement.querySelector('input');
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const maxDropH = 208;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < maxDropH && spaceAbove > spaceBelow;
    const maxH = Math.max(80, openUp ? Math.min(maxDropH, spaceAbove) : Math.min(maxDropH, spaceBelow));

    if (openUp) {
      this.dropdownStyle = {
        bottom: `${window.innerHeight - rect.top + gap}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${maxH}px`,
      };
    } else {
      this.dropdownStyle = {
        top: `${rect.bottom + gap}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${maxH}px`,
      };
    }
  }

  private _addGlobalListeners(): void {
    document.addEventListener('scroll', this._scrollHandler, { capture: true, passive: true });
    document.addEventListener('mousedown', this._clickOutsideHandler, { capture: true });
  }

  private _removeGlobalListeners(): void {
    document.removeEventListener('scroll', this._scrollHandler, { capture: true });
    document.removeEventListener('mousedown', this._clickOutsideHandler, { capture: true });
  }

  /**
   * Alinea `displayText`/`searchText` al `value` actual.
   *   - allowFreeText: displayText = value.
   *   - modo catálogo: displayText = label de la opción con ese value; si no
   *     hay match, fallback a value (opciones no hidratadas o huérfano).
   * Si `_userIsTyping` es true, no pisa — preserva lo que el usuario tipea.
   */
  private _syncDisplayText(): void {
    if (this._userIsTyping) return;

    const current = String(this.value ?? '');
    if (this.allowFreeText || !current) {
      this.displayText = current;
    } else {
      const match = this._options().find(opt => opt.value === current);
      this.displayText = match ? match.label : current;
    }
    this.searchText.set(current);
  }
}
