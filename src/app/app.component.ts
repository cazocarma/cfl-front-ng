import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/services/toast.service';

@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet],
    template: `
      <router-outlet />

      @if (toast.current(); as t) {
        <div
          role="alert"
          aria-live="assertive"
          class="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 animate-fade-in"
          (click)="toast.dismiss()"
        >
          <div
            class="flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-lg backdrop-blur-sm cursor-pointer max-w-lg"
            [class]="t.isError
              ? 'bg-red-600/95 text-white'
              : 'bg-forest-700/95 text-white'"
          >
            <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              @if (t.isError) {
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              } @else {
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              }
            </svg>
            <span class="text-sm font-medium">{{ t.message }}</span>
          </div>
        </div>
      }
    `
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
