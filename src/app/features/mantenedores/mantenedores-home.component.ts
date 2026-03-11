import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CflApiService } from '../../core/services/cfl-api.service';
import { AuthService } from '../../core/services/auth.service';
import { MANTENEDORES_CONFIG, MantenedorConfig } from './mantenedor.config';

@Component({
    selector: 'app-mantenedores-home',
    imports: [DecimalPipe],
    host: { class: 'flex flex-1 flex-col overflow-hidden' },
    templateUrl: './mantenedores-home.component.html'
})
export class MantenedoresHomeComponent implements OnInit {
  // Cards visibles según permisos del usuario
  cardsVisibles = signal<MantenedorConfig[]>([]);
  loading       = signal(true);

  // Conteo de registros por entidad (desde /resumen)
  conteos = signal<Record<string, number>>({});

  constructor(
    private auth:   AuthService,
    private api:    CflApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this._loadResumenYPermisos();
  }

  private _loadResumenYPermisos(): void {
    this.loading.set(true);

    // Obtener contexto de auth para filtrar cards por permiso
    this.api.getAuthContext().subscribe({
      next: (ctx) => {
        const permissions = new Set<string>(ctx.data.permissions);
        const role = ctx.data.role;

        const isAdmin = role === 'administrador' || permissions.has('mantenedores.admin');
        const canViewAll = isAdmin || permissions.has('mantenedores.view');

        const visibles = MANTENEDORES_CONFIG.filter(cfg => {
          if (canViewAll) return true;
          return permissions.has(`mantenedores.view.${cfg.permiso}`);
        });

        this.cardsVisibles.set(visibles);
        this._loadConteos();
      },
      error: () => {
        // Si falla el contexto (usuario normal sin permiso explícito),
        // mostrar todas las cards igualmente y dejar que el backend rechace 403
        this.cardsVisibles.set(MANTENEDORES_CONFIG);
        this._loadConteos();
      },
    });
  }

  private _loadConteos(): void {
    // Carga conteos desde el endpoint /resumen
    this.api.listMaintainerRows('resumen' as string).subscribe({
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
