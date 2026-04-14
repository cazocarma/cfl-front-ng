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
 * Parsea un valor a Date en hora local (calendario).
 *
 * Regla única: si el string empieza con `YYYY-MM-DD`, esos dígitos SON la
 * fecha calendario que queremos mostrar — ignoramos la parte horaria/zona.
 * Esto evita el clásico bug de SQL Server serializando `DATE` como
 * `YYYY-MM-DDT00:00:00Z` y luego JS restándole 3h en Chile (UTC-3), con lo
 * que una fecha guardada como "9 de febrero" termina exhibida como "8 de
 * febrero" y similares desfases ambiguos entre día y mes.
 *
 * Si el string NO tiene prefijo `YYYY-MM-DD` (formato desconocido), se deja
 * al constructor `Date(string)` — pero el backend NO debería enviar fechas
 * en otro formato.
 */
export function parseLocalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;

  // Fecha calendario pura "YYYY-MM-DD" → construir como local (sin pasar por
  // UTC, que produciría desfase de 1 día en Chile UTC-3).
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  // "YYYY-MM-DDTHH:mm:ss" (sin Z ni offset) → tratar como hora local emitida.
  const localDT = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (localDT) {
    return new Date(
      Number(localDT[1]), Number(localDT[2]) - 1, Number(localDT[3]),
      Number(localDT[4]), Number(localDT[5]),
      localDT[6] ? Number(localDT[6]) : 0,
    );
  }

  // "YYYY-MM-DDT00:00:00(.000)?Z" → DATE column que mssql serializa como UTC
  // midnight. Es una fecha calendario disfrazada; la tratamos como tal.
  const midnightZ = s.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?Z$/);
  if (midnightZ) {
    return new Date(Number(midnightZ[1]), Number(midnightZ[2]) - 1, Number(midnightZ[3]));
  }

  // Timestamp real con Z/offset → instante UTC, dejamos que JS lo convierta
  // a local correctamente.
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
