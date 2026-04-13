import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CflApiService } from '../../core/services/cfl-api.service';
import { AuthzService } from '../../core/services/authz.service';
import { Perms, Roles } from '../../core/config/permissions';
import { MANTENEDORES_CONFIG, MantenedorConfig } from './mantenedor.config';

const MANTENEDOR_FRECUENCIA_ORDEN = [
  'imputaciones-flete',
  'tipos-flete',
  'tarifas',
  'detalles-viaje',
  'rutas',
  'nodos',
  'centros-costo',
  'cuentas-mayor',
  'tipos-camion',
  'camiones',
  'choferes',
  'empresas-transporte',
  'productores',
  'temporadas',
  'usuarios',
] as const;

const MANTENEDOR_FRECUENCIA_MAP = new Map<string, number>(
  MANTENEDOR_FRECUENCIA_ORDEN.map((key, index) => [key, index])
);

@Component({
    selector: 'app-mantenedores-home',
    imports: [DecimalPipe],
    host: { class: 'flex flex-1 flex-col overflow-hidden' },
    templateUrl: './mantenedores-home.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MantenedoresHomeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  // Cards visibles según permisos del usuario
  cardsVisibles = signal<MantenedorConfig[]>([]);
  loading       = signal(true);

  // Conteo de registros por entidad (desde /resumen)
  conteos = signal<Record<string, number>>({});

  constructor(
    private authz:  AuthzService,
    private api:    CflApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this._loadResumenYPermisos();
  }

  private _orderByFrecuencia(configs: MantenedorConfig[]): MantenedorConfig[] {
    return [...configs].sort((a, b) => {
      const pa = MANTENEDOR_FRECUENCIA_MAP.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const pb = MANTENEDOR_FRECUENCIA_MAP.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
  }

  private _loadResumenYPermisos(): void {
    this.loading.set(true);

    const isAdmin =
      this.authz.hasPermission(Perms.MANTENEDORES_ADMIN) ||
      this.authz.primaryRole() === Roles.ADMINISTRADOR;

    const canViewAll = isAdmin || this.authz.hasPermission(Perms.MANTENEDORES_VIEW);

    const visibles = MANTENEDORES_CONFIG.filter(cfg => {
      if (canViewAll) return true;
      return this.authz.hasPermission(`mantenedores.view.${cfg.permiso}`);
    });

    this.cardsVisibles.set(this._orderByFrecuencia(visibles));
    this._loadConteos();
  }

  private _loadConteos(): void {
    // Carga conteos desde el endpoint /resumen
    this.api.listMaintainerRows('resumen' as string).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        const mapa: Record<string, number> = {};
        if (Array.isArray(res.data)) {
          res.data.forEach((item: any) => { mapa[item.key] = item.total; });
        }
        this.conteos.set(mapa);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  navigateTo(key: string): void {
    this.router.navigate(['/mantenedores', key]);
  }

  getConteo(key: string): number {
    return this.conteos()[key] ?? 0;
  }
}
