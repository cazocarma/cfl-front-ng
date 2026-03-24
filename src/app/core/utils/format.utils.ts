/**
 * Utilidades de formato compartidas.
 * Usa instancias singleton de Intl para evitar recrearlas en cada llamada.
 * IMPORTANTE: Todas las fechas se interpretan en hora local (no UTC).
 */

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CL');

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCLP(value: unknown): string {
  return clpFormatter.format(Number(value) || 0);
}

/**
 * Parsea un valor a Date en hora local.
 * Maneja "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss" y variantes con Z/offset.
 */
export function parseLocalDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();

  // "YYYY-MM-DD" (solo fecha) — parsear como local, no UTC
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  // "YYYY-MM-DDTHH:mm:ss" (sin Z ni offset) — parsear como local
  const localDT = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDT) {
    return new Date(
      Number(localDT[1]), Number(localDT[2]) - 1, Number(localDT[3]),
      Number(localDT[4]), Number(localDT[5]), Number(localDT[6] || 0)
    );
  }

  // Cualquier otro formato (con Z, offset, etc.) — dejar que Date lo interprete
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Formatea fecha a dd-mm-yyyy en hora local. */
export function formatDate(value: unknown): string {
  const d = parseLocalDate(value);
  return d ? dateFormatter.format(d) : '-';
}

/** Formatea fecha+hora a dd-mm-yyyy, hh:mm en hora local. */
export function formatDateTime(value: unknown): string {
  const d = parseLocalDate(value);
  return d ? dateTimeFormatter.format(d) : '-';
}

/** Retorna "YYYY-MM-DD" en hora local (para inputs type=date). */
export function toLocalDateInput(value: unknown): string {
  const d = parseLocalDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Retorna "HH:mm" en hora local (para inputs type=time). */
export function toLocalTimeInput(value: unknown): string {
  const d = parseLocalDate(value);
  if (!d) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
