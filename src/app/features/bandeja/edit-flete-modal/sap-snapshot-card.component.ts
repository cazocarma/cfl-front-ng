import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-sap-snapshot-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
      <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 border border-amber-200 mt-0.5">
        <svg class="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1.5">Origen SAP vinculado</p>
        <div class="flex flex-wrap gap-2">
          @if (entrega) {
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm">
              <span class="text-amber-500">Entrega:</span> {{ entrega }}
            </span>
          }
          @if (guia) {
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm">
              <span class="text-amber-500">Guía:</span> {{ guia }}
            </span>
          }
          @if (productor) {
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm">
              <span class="text-amber-500">Productor:</span> {{ productor }}
            </span>
          }
          @if (posicionCount > 0) {
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm">
              <span class="text-amber-500">Posiciones:</span> {{ posicionCount }}
            </span>
          }
        </div>
      </div>
    </div>
  `,
})
export class SapSnapshotCardComponent {
  @Input() entrega = '';
  @Input() guia = '';
  @Input() productor = '';
  @Input() posicionCount = 0;
}
