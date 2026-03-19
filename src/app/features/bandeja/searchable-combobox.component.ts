import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';


export interface SearchableOption {
  value: string;
  label: string;
}

@Component({
    selector: 'app-searchable-combobox',
    imports: [NgStyle],
    template: `
    <div class="grid gap-2">
      @if (label) {
        <label class="field-label">{{ label }}{{ required ? ' *' : '' }}</label>
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
          (blur)="closeDropdownDelayed()"
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
      max-height: 208px;
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
  @Input() options: SearchableOption[] = [];
  @Input() value: string | null = '';
  @Output() valueChange = new EventEmitter<string>();

  readonly searchText = signal('');
  private readonly _options = signal<SearchableOption[]>([]);
  displayText = '';
  isOpen = false;
  openUpward = false;
  dropdownStyle: Record<string, string> = {};

  readonly filteredOptions = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const opts = this._options();
    if (!query) return opts;
    return opts.filter(opt => opt.label.toLowerCase().includes(query));
  });

  private _closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private _scrollHandler = (event: Event) => {
    if (this._el.nativeElement.contains(event.target as Node)) return;
    this._closeImmediate();
  };

  constructor(private _el: ElementRef) {}

  ngOnDestroy(): void {
    this._removeScrollListener();
    if (this._closeTimeoutId !== null) {
      clearTimeout(this._closeTimeoutId);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this._options.set(this.options);
    }
    if (changes['value'] || changes['options']) {
      this._syncDisplayText();
    }
  }

  onInput(value: string): void {
    this.searchText.set(value);
    this.displayText = value;
    if (!value) {
      this.valueChange.emit('');
    }
    this.isOpen = true;
  }

  selectOption(option: SearchableOption | null): void {
    if (!option) {
      this.searchText.set('');
      this.displayText = '';
      this.valueChange.emit('');
    } else {
      this.searchText.set(option.label);
      this.displayText = option.label;
      this.valueChange.emit(option.value);
    }
    this.isOpen = false;
  }

  openDropdown(): void {
    if (!this.disabled) {
      this.searchText.set('');
      this._calcDirection();
      this.isOpen = true;
      this._addScrollListener();
    }
  }

  private _calcDirection(): void {
    const input: HTMLElement = this._el.nativeElement.querySelector('input');
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const dropdownHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    if (this.openUpward) {
      this.dropdownStyle = {
        top: `${rect.top - dropdownHeight + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    } else {
      this.dropdownStyle = {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    }
  }

  closeDropdownDelayed(): void {
    this._closeTimeoutId = setTimeout(() => {
      this._closeTimeoutId = null;
      this._closeImmediate();
    }, 180);
  }

  private _closeImmediate(): void {
    this.isOpen = false;
    this._syncDisplayText();
    this._removeScrollListener();
  }

  private _addScrollListener(): void {
    document.addEventListener('scroll', this._scrollHandler, { capture: true, passive: true });
  }

  private _removeScrollListener(): void {
    document.removeEventListener('scroll', this._scrollHandler, { capture: true });
  }

  private _syncDisplayText(): void {
    const selected = this.options.find((opt) => opt.value === String(this.value ?? ''));
    const label = selected?.label ?? '';
    this.searchText.set(label);
    this.displayText = label;
  }
}
