import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  isError: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private _timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, isError = false, durationMs = 5000): void {
    clearTimeout(this._timer);
    this.current.set({ message, isError });
    this._timer = setTimeout(() => this.current.set(null), durationMs);
  }

  dismiss(): void {
    clearTimeout(this._timer);
    this.current.set(null);
  }
}
