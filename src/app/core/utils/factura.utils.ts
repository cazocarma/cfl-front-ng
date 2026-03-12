import { EstadoFactura } from '../models/factura.model';

export const ESTADO_FACTURA_LABELS: Record<EstadoFactura, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  anulada: 'Anulada',
};

export const ESTADO_FACTURA_CHIP: Record<EstadoFactura, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitida: 'bg-emerald-100 text-emerald-700',
  anulada: 'bg-red-100 text-red-700',
};

export function estadoLabel(estado: EstadoFactura): string {
  return ESTADO_FACTURA_LABELS[estado] ?? estado;
}

export function estadoChipClass(estado: EstadoFactura): string {
  return ESTADO_FACTURA_CHIP[estado] ?? 'bg-slate-100 text-slate-700';
}
