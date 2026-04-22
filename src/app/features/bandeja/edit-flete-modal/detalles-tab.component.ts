import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

import { SearchableComboboxComponent, SearchableOption } from '../searchable-combobox.component';
import { DetalleDraft, DetalleGrupo, groupDetailRows } from './edit-flete-modal.types';

@Component({
  selector: 'app-detalles-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchableComboboxComponent],
  styles: [`
    .field-label {
      @apply block text-xs font-semibold text-forest-700 uppercase tracking-wider mb-1.5;
    }
    .detail-chip {
      @apply inline-flex items-center rounded-full border border-forest-200 bg-white px-2.5 py-1 text-[11px] font-medium text-forest-700;
    }
  `],
  templateUrl: './detalles-tab.component.html',
})
export class DetallesTabComponent {
  @Input() set rows(value: DetalleDraft[]) { this._rows.set(value); }
  @Input() readOnly = false;
  @Input() sapBacked = false;
  @Input() origenDatos: 'DESPACHO' | 'RECEPCION' | null = null;
  @Input() especieOptions: SearchableOption[] = [];
  @Input() loading = false;
  @Input() error = '';

  @Output() rowsChange = new EventEmitter<DetalleDraft[]>();

  private _rows = signal<DetalleDraft[]>([]);

  readonly groupedRows = computed<DetalleGrupo[]>(() => groupDetailRows(this._rows()));

  readonly totalCantidad = computed(() =>
    this.groupedRows().reduce((sum, g) => sum + g.cantidad_total, 0)
  );

  readonly totalPeso = computed(() =>
    this.groupedRows().reduce((sum, g) => sum + g.peso_total, 0)
  );

  readonly totalPosiciones = computed(() =>
    this.groupedRows().reduce((sum, g) => sum + g.posicion_count, 0)
  );

  readonly dominantUnit = computed(() => {
    const freq = new Map<string, number>();
    for (const g of this.groupedRows()) {
      const u = g.unidad || 'UN';
      freq.set(u, (freq.get(u) || 0) + g.posicion_count);
    }
    let best = 'UN', max = 0;
    for (const [unit, count] of freq) {
      if (count > max) { max = count; best = unit; }
    }
    return best;
  });

  get headerTitle(): string {
    if (!this.sapBacked) return 'Detalle de flete';
    return this.origenDatos === 'RECEPCION' ? 'Posiciones obtenidas desde Romana' : 'Posiciones obtenidas desde SAP (LIPS)';
  }

  get headerDescription(): string {
    if (!this.sapBacked) return 'Agrega una o mas lineas para construir el detalle manual.';
    return this.origenDatos === 'RECEPCION'
      ? 'Las posiciones se cargan desde Romana y se enviaran junto con la cabecera.'
      : 'Las posiciones se cargan desde SAP y se enviaran junto con la cabecera.';
  }

  get canManage(): boolean {
    return !this.readOnly && !this.sapBacked;
  }

  addDetailRow(): void {
    if (this.readOnly) return;
    const newRow: DetalleDraft = {
      rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id_especie: '', material: '', descripcion: '', cantidad: '',
      unidad: 'UN', peso: '', sap_posicion: '', sap_posicion_superior: '', sap_lote: '',
      id_romana_entrega: '', romana_numero_partida: '',
    };
    const updated = [...this._rows(), newRow];
    this._rows.set(updated);
    this.rowsChange.emit(updated);
  }

  removeDetailGroup(materialKey: string): void {
    if (this.readOnly) return;
    const updated = this._rows().filter(row =>
      (row.material.trim().toUpperCase() || row.rowId) !== materialKey,
    );
    this._rows.set(updated);
    this.rowsChange.emit(updated);
  }

  updateGroupEspecie(materialKey: string, value: string): void {
    if (this.readOnly) return;
    const updated = this._rows().map(row => {
      const k = row.material.trim().toUpperCase() || row.rowId;
      return k === materialKey ? { ...row, id_especie: value } : row;
    });
    this._rows.set(updated);
    this.rowsChange.emit(updated);
  }

  updateGroupField(
    materialKey: string,
    field: 'material' | 'descripcion' | 'cantidad' | 'unidad' | 'peso',
    value: string,
  ): void {
    if (this.readOnly || this.sapBacked) return;
    const rows = this._rows();
    const groupIds = rows
      .filter(r => ((r.material || '').trim().toUpperCase() || r.rowId) === materialKey)
      .map(r => r.rowId);

    const updated = rows.map(row => {
      const k = (row.material || '').trim().toUpperCase() || row.rowId;
      if (k !== materialKey) return row;

      // Campos numéricos en grupo multi-fila: valor en la primera, cero en el resto
      if ((field === 'cantidad' || field === 'peso') && groupIds.length > 1) {
        return row.rowId === groupIds[0]
          ? { ...row, [field]: value }
          : { ...row, [field]: '0' };
      }
      return { ...row, [field]: value };
    });
    this._rows.set(updated);
    this.rowsChange.emit(updated);
  }

  formatNum(value: number, decimals: number): string {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
}
