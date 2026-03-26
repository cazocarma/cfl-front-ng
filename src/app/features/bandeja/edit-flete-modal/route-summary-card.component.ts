import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-route-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .route-node {
      @apply min-w-[120px] rounded-xl border border-forest-200 bg-white px-3 py-2 text-center text-xs font-semibold text-forest-800 shadow-sm;
    }
  `],
  template: `
    <div
      class="rounded-2xl border px-4 py-4"
      [class]="resolved
        ? 'border-forest-200 bg-gradient-to-br from-forest-50 to-emerald-50/40'
        : 'border-forest-100 bg-forest-50/50'"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
            [class]="resolved ? 'bg-forest-100 border border-forest-200' : 'bg-forest-100/60 border border-forest-100'"
          >
            <svg
              class="h-4 w-4"
              [class]="resolved ? 'text-forest-600' : 'text-forest-400'"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-forest-500">Ruta estimada</p>
            <p class="mt-0.5 text-sm font-semibold inline-flex items-center gap-2" [class]="resolved ? 'text-forest-900' : 'text-forest-400'">
              {{ resolved ? routeName : 'Pendiente por resolver' }}
              @if (sentido) {
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  [class]="sentido === 'IDA' ? 'bg-forest-100 text-forest-700' : 'bg-amber-100 text-amber-700'">
                  {{ sentido }}
                </span>
              }
            </p>
            <p class="mt-0.5 text-[11px] text-forest-500">{{ hint }}</p>
          </div>
        </div>
        <div
          class="rounded-xl border px-4 py-3 text-right shadow-sm min-w-[140px]"
          [class]="hasMonto
            ? 'border-emerald-200 bg-white'
            : 'border-forest-100 bg-white'"
        >
          <p class="text-[10px] font-bold uppercase tracking-widest" [class]="hasMonto ? 'text-emerald-600' : 'text-forest-400'">
            {{ temporadaLabel }}
          </p>
          <p class="mt-1 text-xl font-bold" [class]="hasMonto ? 'text-forest-900' : 'text-forest-300'">
            {{ montoTotalLabel }}
          </p>
          @if (distanceKm !== null) {
            <p class="mt-0.5 text-[11px] text-forest-400">{{ distanceKm }} km</p>
          }
        </div>
      </div>

      <!-- Visualización de la ruta origen → destino -->
      <div class="mt-4 flex items-center gap-2">
        <div class="route-node flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-forest-400 flex-shrink-0"></span>
          {{ origenLabel }}
        </div>
        <div class="flex min-w-0 flex-1 items-center gap-1">
          <span class="h-px flex-1" [class]="resolved ? 'bg-forest-400' : 'bg-forest-200'"></span>
          <svg class="h-3 w-3 flex-shrink-0" [class]="resolved ? 'text-forest-500' : 'text-forest-300'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
          <span class="h-px flex-1" [class]="resolved ? 'bg-forest-400' : 'bg-forest-200'"></span>
        </div>
        <div class="route-node flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
          {{ destinoLabel }}
        </div>
      </div>
    </div>
  `,
})
export class RouteSummaryCardComponent {
  @Input() resolved = false;
  @Input() hasMonto = false;
  @Input() routeName = '';
  @Input() hint = '';
  @Input() temporadaLabel = '';
  @Input() montoTotalLabel = '';
  @Input() distanceKm: number | null = null;
  @Input() origenLabel = 'Origen';
  @Input() destinoLabel = 'Destino';
  @Input() sentido: 'IDA' | 'VUELTA' | null = null;
}
