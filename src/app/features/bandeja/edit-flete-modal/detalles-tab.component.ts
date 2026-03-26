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
import { DetalleDraft, DetalleGrupo } from './edit-flete-modal.types';

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
  @Input() especieOptions: SearchableOption[] = [];
  @Input() loading = false;
  @Input() error = '';

  @Output() rowsChange = new EventEmitter<DetalleDraft[]>();

  private _rows = signal<DetalleDraft[]>([]);

  readonly groupedRows = computed<DetalleGrupo[]>(() => {
    const rows = this._rows();
    const groups = new Map<string, DetalleGrupo>();
    for (const row of rows) {
      const mat = row.material.trim().toUpperCase();
      const key = mat || row.rowId;
      if (!groups.has(key)) {
        groups.set(key, {
          materialKey: key,
          material: row.material,
          descripcion: row.descripcion,
          cantidad_total: Number(row.cantidad) || 0,
          peso_total: Number(row.peso) || 0,
          unidad: row.unidad,
          id_especie: row.id_especie,
          rowIds: [row.rowId],
          lotes: row.sap_lote ? [row.sap_lote] : [],
          posicion_count: 1,
        });
      } else {
        const g = groups.get(key)!;
        g.cantidad_total += Number(row.cantidad) || 0;
        g.peso_total += Number(row.peso) || 0;
        g.rowIds.push(row.rowId);
        g.posicion_count++;
        if (row.sap_lote && !g.lotes.includes(row.sap_lote)) g.lotes.push(row.sap_lote);
        if (!g.id_especie && row.id_especie) g.id_especie = row.id_especie;
      }
    }
    return Array.from(groups.values());
  });

  get canManage(): boolean {
    return !this.readOnly && !this.sapBacked;
  }

  addDetailRow(): void {
    if (this.readOnly) return;
    const newRow: DetalleDraft = {
      rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id_especie: '', material: '', descripcion: '', cantidad: '',
      unidad: '', peso: '', sap_posicion: '', sap_posicion_superior: '', sap_lote: '',
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
      .filter(r => (r.material.trim().toUpperCase() || r.rowId) === materialKey)
      .map(r => r.rowId);

    let updated: DetalleDraft[];
    if (groupIds.length <= 1) {
      updated = rows.map(row => {
        const k = row.material.trim().toUpperCase() || row.rowId;
        return k === materialKey ? { ...row, [field]: value } : row;
      });
    } else {
      const firstId = groupIds[0];
      updated = rows
        .filter(r => r.rowId === firstId || (r.material.trim().toUpperCase() || r.rowId) !== materialKey)
        .map(row => row.rowId === firstId ? { ...row, [field]: value } : row);
    }
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
