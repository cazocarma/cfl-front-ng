import { CriterioAgrupacion } from '../models/factura.model';

/** Criterio de agrupación por defecto para las pre facturas */
export const CRITERIO_DEFECTO: CriterioAgrupacion = 'tipo_flete';

/** Nombres de meses en español (index 0 vacío para que index=mes) */
export const NOMBRES_MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** Retorna el nombre del mes en español (1-12) */
export function nombreMes(mes: number): string {
  return NOMBRES_MESES[mes] || '';
}
