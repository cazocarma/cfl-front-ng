import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';

import { CflApiService } from '../../core/services/cfl-api.service';
import { WorkspaceShellComponent } from '../workspace/workspace-shell.component';

interface AuditoriaOverviewData {
  resumen: Record<string, unknown>;
  entidades: Array<Record<string, unknown>>;
  acciones: Array<Record<string, unknown>>;
  registros: Array<Record<string, unknown>>;
}

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, WorkspaceShellComponent],
  template: `
    <app-workspace-shell
      title="Auditoría"
      subtitle="Trazabilidad de acciones de usuario, entidades impactadas y actividad reciente."
      activeSection="auditoria"
    >
      <div class="space-y-6">
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Registros</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['total_registros']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Total de filas en auditoría.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Hoy</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['registros_hoy']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Eventos registrados en la fecha actual.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Usuarios 7d</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['usuarios_7d']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Usuarios con actividad en los últimos 7 días.</p>
          </article>

          <article class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-forest-500">Ventana</p>
            <p class="mt-3 text-3xl font-bold text-forest-900">{{ toNumber(data()?.resumen?.['limit']) }}</p>
            <p class="mt-2 text-xs text-forest-500">Cantidad máxima de registros cargados en esta vista.</p>
          </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
          <div class="space-y-6">
            <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm font-semibold text-forest-900">Entidades más auditadas</h2>
                  <p class="mt-1 text-xs text-forest-500">Frecuencia acumulada por entidad.</p>
                </div>
                <button type="button" (click)="load()" [disabled]="loading()" class="btn-ghost">
                  Actualizar
                </button>
              </div>

              <div class="mt-4 space-y-3">
                @for (row of data()?.entidades ?? []; track row['entidad']) {
                  <div class="rounded-2xl border border-forest-100 bg-forest-50 px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                      <p class="text-sm font-medium text-forest-900">{{ row['entidad'] || 'Sin entidad' }}</p>
                      <span class="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-forest-700 shadow-sm">
                        {{ toNumber(row['total']) }}
                      </span>
                    </div>
                  </div>
                } @empty {
                  <div class="rounded-xl border border-dashed border-forest-200 px-4 py-5 text-sm text-forest-500">
                    Aún no hay entidades auditadas.
                  </div>
                }
              </div>
            </div>

            <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
              <h2 class="text-sm font-semibold text-forest-900">Acciones más frecuentes</h2>
              <p class="mt-1 text-xs text-forest-500">Distribución resumida por acción.</p>

              <div class="mt-4 flex flex-wrap gap-2">
                @for (row of data()?.acciones ?? []; track row['accion']) {
                  <span class="rounded-full bg-forest-100 px-3 py-1.5 text-xs font-semibold text-forest-700">
                    {{ row['accion'] || 'Sin acción' }} · {{ toNumber(row['total']) }}
                  </span>
                } @empty {
                  <span class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    Sin acciones registradas
                  </span>
                }
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-forest-100 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-forest-900">Actividad reciente</h2>
            <p class="mt-1 text-xs text-forest-500">Ultimos eventos trazados desde la tabla de auditoria.</p>

            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-forest-100 text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.18em] text-forest-500">
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Usuario</th>
                    <th class="px-4 py-3">Acción</th>
                    <th class="px-4 py-3">Entidad</th>
                    <th class="px-4 py-3">Resumen</th>
                    <th class="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-forest-100">
                  @if (loading()) {
                    <tr>
                      <td colspan="6" class="px-4 py-5 text-center text-sm text-forest-500">
                        Cargando auditoría...
                      </td>
                    </tr>
                  } @else {
                    @for (row of data()?.registros ?? []; track row['id_auditoria']) {
                      <tr>
                        <td class="px-4 py-3 text-forest-600">{{ formatDateTime(row['fecha_hora']) }}</td>
                        <td class="px-4 py-3 font-medium text-forest-900">{{ row['usuario'] || 'Sin usuario' }}</td>
                        <td class="px-4 py-3 text-forest-600">{{ row['accion'] || '-' }}</td>
                        <td class="px-4 py-3 text-forest-600">
                          {{ row['entidad'] || '-' }}
                          @if (row['id_entidad']) {
                            <span class="text-xs text-forest-400">#{{ row['id_entidad'] }}</span>
                          }
                        </td>
                        <td class="px-4 py-3 text-forest-600">{{ row['resumen'] || '-' }}</td>
                        <td class="px-4 py-3 text-forest-500">{{ row['ip_equipo'] || '-' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="px-4 py-5 text-center text-sm text-forest-500">
                          No hay eventos de auditoría registrados.
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </app-workspace-shell>
  `,
})
export class AuditoriaComponent implements OnInit {
  readonly loading = signal(false);
  readonly data = signal<AuditoriaOverviewData | null>(null);

  constructor(private cflApi: CflApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.cflApi.getAuditoriaOverview().subscribe({
      next: (response) => {
        this.data.set(response.data as AuditoriaOverviewData);
        this.loading.set(false);
      },
      error: () => {
        this.data.set({
          resumen: {},
          entidades: [],
          acciones: [],
          registros: [],
        });
        this.loading.set(false);
      },
    });
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  formatDateTime(value: unknown): string {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
