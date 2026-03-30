import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, of, retry, map, tap } from 'rxjs';

import { CflApiService } from './cfl-api.service';
import { CatalogCacheSnapshot, TarifaListResponse } from '../../features/bandeja/edit-flete-modal/edit-flete-modal.types';
import { toString as fleteToString } from '../utils/flete-form.utils';
import { SearchableOption } from '../../features/bandeja/searchable-combobox.component';

export interface ImputacionIndexes {
  byTipo: Map<string, Record<string, unknown>[]>;
  byId: Map<string, Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class FleteCatalogService {
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static cache: CatalogCacheSnapshot | null = null;

  constructor(private cflApi: CflApiService) {}

  /** Invalida el cache para forzar recarga desde el servidor. */
  invalidateCache(): void {
    FleteCatalogService.cache = null;
  }

  /**
   * Carga todos los catálogos necesarios para el modal de fletes.
   * Usa cache de 5 minutos para evitar llamadas repetidas.
   * Si el cache es válido, retorna el snapshot en cache.
   */
  loadAll(): Observable<CatalogCacheSnapshot> {
    const cached = FleteCatalogService.cache;
    if (cached && (Date.now() - cached.loadedAt) < FleteCatalogService.CACHE_TTL_MS) {
      return of(cached);
    }

    return forkJoin({
      tiposFlete: this._safeCatalog('tipos-flete'),
      tiposCamion: this._safeCatalog('tipos-camion'),
      centrosCosto: this._safeCatalog('centros-costo'),
      detallesViaje: this._safeCatalog('detalles-viaje'),
      nodos: this._safeCatalog('nodos'),
      rutas: this._safeCatalog('rutas'),
      tarifas: this._safeTarifas(),
      empresas: this._safeCatalog('empresas-transporte'),
      choferes: this._safeCatalog('choferes'),
      camiones: this._safeCatalog('camiones'),
      cuentasMayor: this._safeCatalog('cuentas-mayor'),
      imputacionesFlete: this._safeCatalog('imputaciones-flete'),
      especies: this._safeCatalog('especies'),
    }).pipe(
      map((res) => {
        const tarifas = res.tarifas.data as Record<string, unknown>[];
        const snapshot: CatalogCacheSnapshot = {
          loadedAt: Date.now(),
          tiposFlete: res.tiposFlete.data as Record<string, unknown>[],
          tiposCamion: res.tiposCamion.data as Record<string, unknown>[],
          centrosCosto: res.centrosCosto.data as Record<string, unknown>[],
          detallesViaje: res.detallesViaje.data as Record<string, unknown>[],
          nodos: res.nodos.data as Record<string, unknown>[],
          rutas: res.rutas.data as Record<string, unknown>[],
          tarifas,
          empresas: res.empresas.data as Record<string, unknown>[],
          choferes: res.choferes.data as Record<string, unknown>[],
          camiones: res.camiones.data as Record<string, unknown>[],
          cuentasMayor: res.cuentasMayor.data as Record<string, unknown>[],
          imputacionesFlete: res.imputacionesFlete.data as Record<string, unknown>[],
          especies: res.especies.data as Record<string, unknown>[],
          productores: [],
          temporadaId: res.tarifas.temporada_id ?? null,
          temporadaLabel: fleteToString(tarifas[0]?.['temporada_nombre']) || fleteToString(tarifas[0]?.['temporada_codigo']) || '',
        };
        return snapshot;
      }),
      tap((snapshot) => {
        FleteCatalogService.cache = snapshot;
      }),
    );
  }

  /** Carga productores de forma diferida y actualiza el cache. */
  loadProductoresDeferred(): Observable<Record<string, unknown>[]> {
    return this._safeCatalog('productores').pipe(
      map((res) => res.data as Record<string, unknown>[]),
      tap((productores) => {
        const cached = FleteCatalogService.cache;
        if (cached) {
          FleteCatalogService.cache = { ...cached, loadedAt: Date.now(), productores };
        }
      }),
    );
  }

  /** Convierte un array de registros en opciones para SearchableCombobox. */
  mapOptions(source: Record<string, unknown>[], valueField: string, labelFields: string[]): SearchableOption[] {
    return source
      .map((item) => {
        const value = item[valueField];
        if (value === null || value === undefined || value === '') return null;
        const label = labelFields
          .map((field) => fleteToString(item[field]))
          .filter((part) => Boolean(part))
          .join(' - ');
        return { value: String(value), label: label || String(value) };
      })
      .filter((item): item is SearchableOption => item !== null);
  }

  /** Construye índices de imputaciones agrupados por tipo de flete. */
  rebuildImputacionIndexes(imputaciones: Record<string, unknown>[]): ImputacionIndexes {
    const byTipo = new Map<string, Record<string, unknown>[]>();
    const byId = new Map<string, Record<string, unknown>>();

    for (const row of imputaciones) {
      if (!this._isRowActive(row)) continue;
      const id = String(row['id_imputacion_flete'] ?? '');
      const tipoId = String(row['id_tipo_flete'] ?? '');
      if (id) byId.set(id, row);
      if (tipoId) {
        if (!byTipo.has(tipoId)) byTipo.set(tipoId, []);
        byTipo.get(tipoId)!.push(row);
      }
    }

    return { byTipo, byId };
  }

  private _isRowActive(row: Record<string, unknown>): boolean {
    const activo = row['activo'];
    return activo === undefined || activo === null || activo === true || activo === 1 || activo === '1';
  }

  private _safeCatalog(entity: string): Observable<{ data: unknown[] }> {
    return this.cflApi.listMaintainerRows(entity).pipe(
      retry(1),
      catchError(() => of({ data: [] })),
    );
  }

  private _safeTarifas(): Observable<TarifaListResponse> {
    return this.cflApi.listTarifas().pipe(
      retry(1),
      catchError(() => of({ data: [], temporada_id: null })),
    );
  }
}
