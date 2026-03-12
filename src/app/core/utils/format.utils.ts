/**
 * Utilidades de formato compartidas.
 * Usa instancias singleton de Intl para evitar recrearlas en cada llamada.
 */

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CL');

export function formatCLP(value: unknown): string {
  return clpFormatter.format(Number(value) || 0);
}

export function formatDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? '-' : dateFormatter.format(d);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
