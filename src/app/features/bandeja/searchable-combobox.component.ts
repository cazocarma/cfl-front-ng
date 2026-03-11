import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';


export interface SearchableOption {
  value: string;
  label: string;
}

@Component({
    selector: 'app-searchable-combobox',
    imports: [],
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
          <div class="combobox-dropdown">
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
      @apply absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-forest-200 bg-white shadow-lg;
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
export class SearchableComboboxComponent implements OnChanges {
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

  searchText = '';
  displayText = '';
  isOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['options']) {
      this._syncDisplayText();
    }
  }

  filteredOptions(): SearchableOption[] {
    const query = this.searchText.trim().toLowerCase();
    if (!query) {
      return this.options;
    }
    return this.options.filter((opt) => opt.label.toLowerCase().includes(query));
  }

  onInput(value: string): void {
    this.searchText = value;
    this.displayText = value;
    if (!value) {
      this.valueChange.emit('');
    }
    this.isOpen = true;
  }

  selectOption(option: SearchableOption | null): void {
    if (!option) {
      this.searchText = '';
      this.displayText = '';
      this.valueChange.emit('');
    } else {
      this.searchText = option.label;
      this.displayText = option.label;
      this.valueChange.emit(option.value);
    }
    this.isOpen = false;
  }

  openDropdown(): void {
    if (!this.disabled) {
      this.searchText = '';
      this.isOpen = true;
    }
  }

  closeDropdownDelayed(): void {
    setTimeout(() => {
      this.isOpen = false;
      this._syncDisplayText();
    }, 180);
  }

  private _syncDisplayText(): void {
    const selected = this.options.find((opt) => opt.value === String(this.value ?? ''));
    this.searchText = selected?.label ?? '';
    this.displayText = this.searchText;
  }
}
