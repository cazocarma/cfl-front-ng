import { Injectable } from '@angular/core';

import { toString as fleteToString, toControlValue, toNullableNumber, formatDateValue } from '../utils/flete-form.utils';
import { SearchableOption } from '../../features/bandeja/searchable-combobox.component';

export interface RouteResolution {
  route: Record<string, unknown> | null;
  routeName: string;
  distanceKm: number | null;
  tarifa: Record<string, unknown> | null;
  monto: number | null;
  moneda: string;
  hint: string;
  sentido: 'IDA' | 'VUELTA' | null;
}

export interface NodeFilterResult {
  origenOptions: SearchableOption[];
  destinoOptions: SearchableOption[];
  destinoHint: string;
  /** true si el destino seleccionado fue invalidado por el cambio de origen */
  destinoCleared: boolean;
}

@Injectable({ providedIn: 'root' })
export class FleteRouteResolverService {

  /**
   * Encuentra una ruta por nodos origen + destino (bidireccional).
   * Retorna la ruta y el sentido: IDA si coincide directo, VUELTA si coincide invertido.
   */
  findRouteByNodes(
    rutas: Record<string, unknown>[],
    origenId: string,
    destinoId: string,
  ): { route: Record<string, unknown> | null; sentido: 'IDA' | 'VUELTA' | null } {
    if (!origenId || !destinoId) return { route: null, sentido: null };
    const direct = rutas.find(
      (row) =>
        String(row['id_origen_nodo']) === origenId &&
        String(row['id_destino_nodo']) === destinoId,
    );
    if (direct) return { route: direct, sentido: 'IDA' };
    const reverse = rutas.find(
      (row) =>
        String(row['id_origen_nodo']) === destinoId &&
        String(row['id_destino_nodo']) === origenId,
    );
    if (reverse) return { route: reverse, sentido: 'VUELTA' };
    return { route: null, sentido: null };
  }

  /**
   * Determina si una tarifa está vigente para la fecha dada.
   */
  isTarifaVigente(row: Record<string, unknown>, fechaIso: string): boolean {
    const start = fleteToString(row['vigencia_desde']);
    const end = fleteToString(row['vigencia_hasta']);
    const active = row['activo'];

    if (active !== undefined && active !== null && Number(active) === 0) return false;
    if (start && fechaIso < start.slice(0, 10)) return false;
    if (end && fechaIso > end.slice(0, 10)) return false;
    return true;
  }

  /**
   * Filtra tarifas vigentes para una fecha, opcionalmente para una ruta específica.
   */
  getSeasonTarifas(
    tarifas: Record<string, unknown>[],
    fechaSalida: string,
    routeId?: string,
  ): Record<string, unknown>[] {
    const fecha = fechaSalida || formatDateValue(new Date());
    return tarifas
      .filter((row) => !routeId || String(row['id_ruta']) === routeId)
      .filter((row) => this.isTarifaVigente(row, fecha));
  }

  /**
   * Filtra tarifas elegibles considerando tipo de camión.
   */
  getEligibleTarifas(
    tarifas: Record<string, unknown>[],
    fechaSalida: string,
    tipoCamionId: string,
    routeId?: string,
  ): Record<string, unknown>[] {
    return this.getSeasonTarifas(tarifas, fechaSalida, routeId)
      .filter((row) => !tipoCamionId || String(row['id_tipo_camion']) === tipoCamionId);
  }

  /**
   * Encuentra la mejor tarifa para una ruta dada.
   */
  findBestTarifaForRoute(
    tarifas: Record<string, unknown>[],
    routeId: string,
    fechaSalida: string,
    tipoCamionId: string,
  ): Record<string, unknown> | null {
    const candidates = this.getEligibleTarifas(tarifas, fechaSalida, tipoCamionId, routeId)
      .sort((a, b) => {
        const priorityA = Number(a['prioridad'] ?? 999999);
        const priorityB = Number(b['prioridad'] ?? 999999);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return Number(a['id_tarifa'] ?? 0) - Number(b['id_tarifa'] ?? 0);
      });

    if (candidates.length === 0) return null;
    if (tipoCamionId) return candidates[0];
    return candidates.length === 1 ? candidates[0] : null;
  }

  /**
   * Resuelve ruta + tarifa a partir de los datos de form y catálogos.
   */
  resolveRoute(params: {
    rutas: Record<string, unknown>[];
    tarifas: Record<string, unknown>[];
    origenId: string;
    destinoId: string;
    explicitRouteId: string;
    fechaSalida: string;
    tipoCamionId: string;
    currentMonto: number | null;
    currentExtra: number;
    preserveExistingAmount: boolean;
    temporadaLabel: string;
  }): RouteResolution {
    let { route, sentido } = this.findRouteByNodes(params.rutas, params.origenId, params.destinoId);

    // Si no hay ruta por nodos pero hay id_ruta explícito, buscar por ID
    if (!route && params.explicitRouteId) {
      route = params.rutas.find((row) => String(row['id_ruta']) === params.explicitRouteId) || null;
      if (route) {
        sentido = String(route['id_origen_nodo']) === params.origenId ? 'IDA' : 'VUELTA';
      }
    }

    if (!route) {
      return {
        route: null,
        routeName: '',
        distanceKm: null,
        tarifa: null,
        monto: params.preserveExistingAmount ? params.currentMonto : null,
        moneda: '',
        hint: 'Selecciona origen y destino para resolver la ruta.',
        sentido: null,
      };
    }

    const routeName = fleteToString(route['nombre_ruta']) || '';
    const distanceKm = toNullableNumber(route['distancia_km']);
    const routeId = String(route['id_ruta']);

    const tarifa = this.findBestTarifaForRoute(
      params.tarifas, routeId, params.fechaSalida, params.tipoCamionId,
    );

    if (tarifa) {
      const monto = toNullableNumber(tarifa['monto_fijo']);
      return {
        route,
        routeName,
        distanceKm,
        tarifa,
        monto,
        moneda: fleteToString(tarifa['moneda']) || '',
        hint: params.temporadaLabel
          ? `Tarifa resuelta para la temporada ${params.temporadaLabel}.`
          : 'Tarifa vigente resuelta automaticamente.',
        sentido,
      };
    }

    return {
      route,
      routeName,
      distanceKm,
      tarifa: null,
      monto: params.preserveExistingAmount ? params.currentMonto : null,
      moneda: '',
      hint: params.tipoCamionId
        ? 'No existe una tarifa vigente para esta ruta y tipo de camion en la temporada actual.'
        : 'La ruta se resolvio, pero falta tipo de camion o no hay tarifa vigente para estimar el valor.',
      sentido,
    };
  }

  /**
   * Calcula los nodos origen/destino permitidos según tarifas vigentes.
   */
  getFilteredNodes(params: {
    rutas: Record<string, unknown>[];
    tarifas: Record<string, unknown>[];
    nodoOptions: SearchableOption[];
    fechaSalida: string;
    tipoCamionId: string;
    selectedOrigen: string;
    selectedDestino: string;
    clearInvalidDestino: boolean;
  }): NodeFilterResult {
    // Orígenes: filtrar por rutas que tengan tarifa vigente (sin filtro tipo_camion)
    const seasonTarifas = this.getSeasonTarifas(params.tarifas, params.fechaSalida);
    const allowedRouteIdsForOrigen = new Set(
      seasonTarifas.map((row) => toControlValue(row['id_ruta'])).filter(Boolean),
    );

    const activeRutas = params.rutas.filter((row) => {
      const activo = row['activo'];
      return activo === undefined || activo === null || activo === true || activo === 1 || String(activo).toLowerCase() === 'true';
    });

    const allowedOrigins = new Set<string>();
    activeRutas
      .filter((row) => allowedRouteIdsForOrigen.has(toControlValue(row['id_ruta'])))
      .forEach((row) => {
        const o = toControlValue(row['id_origen_nodo']);
        const d = toControlValue(row['id_destino_nodo']);
        if (o) allowedOrigins.add(o);
        if (d) allowedOrigins.add(d);
      });

    const origenOptions = allowedOrigins.size === 0
      ? params.nodoOptions
      : params.nodoOptions.filter(
          (opt) => allowedOrigins.has(opt.value) || opt.value === params.selectedOrigen,
        );

    if (!params.selectedOrigen) {
      return {
        origenOptions,
        destinoOptions: [],
        destinoHint: 'Selecciona un origen para filtrar los destinos con tarifa vigente.',
        destinoCleared: false,
      };
    }

    // Destinos: filtrar considerando tipo_camion
    const eligibleTarifas = this.getEligibleTarifas(params.tarifas, params.fechaSalida, params.tipoCamionId);
    const allowedRouteIdsForDestino = new Set(
      eligibleTarifas.map((row) => toControlValue(row['id_ruta'])).filter(Boolean),
    );

    const allowedDestinations = new Set<string>();
    activeRutas
      .filter((row) => allowedRouteIdsForDestino.has(toControlValue(row['id_ruta'])))
      .forEach((row) => {
        const o = toControlValue(row['id_origen_nodo']);
        const d = toControlValue(row['id_destino_nodo']);
        if (o === params.selectedOrigen && d) allowedDestinations.add(d);
        if (d === params.selectedOrigen && o) allowedDestinations.add(o);
      });

    let destinoCleared = false;
    let selectedDestino = params.selectedDestino;
    if (params.clearInvalidDestino && selectedDestino && !allowedDestinations.has(selectedDestino)) {
      destinoCleared = true;
      selectedDestino = '';
    }

    const destinoOptions = params.nodoOptions.filter(
      (opt) => allowedDestinations.has(opt.value) || opt.value === selectedDestino,
    );

    const hasTipoCamion = Boolean(params.tipoCamionId);
    const destinoHint = allowedDestinations.size === 0
      ? (hasTipoCamion
        ? 'No hay destinos con tarifa vigente para este origen y tipo de camion en la temporada actual.'
        : 'No hay destinos con tarifa vigente para este origen en la temporada actual.')
      : (hasTipoCamion
        ? 'Destinos filtrados por origen, temporada activa y tipo de camion.'
        : 'Destinos filtrados por origen y temporada activa.');

    return { origenOptions, destinoOptions, destinoHint, destinoCleared };
  }
}
