import { APP_INITIALIZER, ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authnInterceptor } from './core/interceptors/authn.interceptor';
import { networkErrorInterceptor } from './core/interceptors/network-error.interceptor';
import { SessionWatcherService } from './core/services/session-watcher.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authnInterceptor, networkErrorInterceptor])),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const watcher = inject(SessionWatcherService);
        return () => watcher.start();
      },
    },
  ],
};
