/**
 * Utilidades puras para el formulario de fletes.
 * Sin dependencias de Angular — funciones deterministas reutilizables.
 */

import { toLocalDateInput, toLocalTimeInput } from './format.utils';

export function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function toString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
}

export function toControlValue(value: unknown): string {
  return toString(value) || '';
}

export function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalized(value: unknown): string {
  return toString(value)?.toLowerCase() || '';
}

export function formatDateValue(value: unknown): string {
  if (!value) return '';
  const raw = String(value);
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];
  return toLocalDateInput(value);
}

export function formatTimeValue(value: unknown): string {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(/(\d{2}:\d{2})(?::\d{2})?/);
  if (match) return match[1];
  return toLocalTimeInput(value);
}
