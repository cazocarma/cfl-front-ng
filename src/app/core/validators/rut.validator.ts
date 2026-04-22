import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador de RUT chileno con dígito verificador (módulo 11).
 * Tolera puntos y guión. Acepta 'k'/'K' como DV.
 *
 * Usado por el modal de flete para validar RUTs ingresados manualmente
 * al crear empresas de transporte o choferes. La normalización es
 * espejo de cfl.Chofer.SapIdFiscalNorm en SQL Server.
 */

/** Normaliza: strip puntos, guiones, espacios, tabs y LF; uppercase. */
export function normalizeRut(value: string | null | undefined): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[.\- \t\n]/g, '');
}

/**
 * Calcula el dígito verificador de un RUT chileno.
 * @param cuerpo sólo dígitos (sin DV, sin puntos ni guión)
 * @returns DV: '0'-'9' o 'K'
 */
function calcularDv(cuerpo: string): string {
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/** Valida formato RUT chileno con dígito verificador. */
export function isValidChileanRut(value: string | null | undefined): boolean {
  const norm = normalizeRut(value);
  if (!norm || norm.length < 2) return false;
  const cuerpo = norm.slice(0, -1);
  const dv = norm.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;
  return calcularDv(cuerpo) === dv;
}

/** Angular ValidatorFn que marca el control como inválido si el RUT no pasa DV. */
export function rutValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null; // optional por defecto
    return isValidChileanRut(value) ? null : { rut: true };
  };
}
