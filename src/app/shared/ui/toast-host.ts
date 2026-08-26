import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toaster } from '../../core/platform/toaster';

/** Renders the transient toast stack, including undo actions. */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (toast of toaster.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.tone">
          <span class="toast__message">{{ toast.message }}</span>
          @if (toast.action; as action) {
            <button type="button" (click)="run(toast.id, action.run)">{{ action.label }}</button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  protected readonly toaster = inject(Toaster);

  protected run(id: number, action: () => void): void {
    action();
    this.toaster.dismiss(id);
  }
}
