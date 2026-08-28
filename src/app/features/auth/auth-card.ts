import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18n } from '../../core/i18n/i18n.service';
import { Toaster } from '../../core/platform/toaster';
import { AuthMode, AuthStore } from '../../core/supabase/auth-store';

/** Email sign-in for the leaderboard and cross-device sync. */
@Component({
  selector: 'app-auth-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="card auth" (ngSubmit)="submit()">
      <div class="tabs" role="tablist">
        @for (option of modes(); track option.value) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === option.value"
            [class.active]="mode() === option.value"
            (click)="mode.set(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <div class="field">
        <label for="auth-email">{{ msg().auth.email }}</label>
        <input
          id="auth-email"
          type="email"
          autocomplete="email"
          required
          [ngModel]="email()"
          (ngModelChange)="email.set($event)"
          name="email"
        />
      </div>

      <div class="field">
        <label for="auth-password">{{ msg().auth.password }}</label>
        <input
          id="auth-password"
          type="password"
          [attr.autocomplete]="mode() === 'sign-up' ? 'new-password' : 'current-password'"
          minlength="6"
          [ngModel]="password()"
          (ngModelChange)="password.set($event)"
          name="password"
        />
      </div>

      <button type="submit" class="btn btn--primary btn--block" [disabled]="auth.busy()">
        {{ mode() === 'sign-up' ? msg().auth.createAccount : msg().auth.signIn }}
      </button>
      <button
        type="button"
        class="btn btn--ghost btn--block"
        [disabled]="auth.busy()"
        (click)="magicLink()"
      >
        {{ msg().auth.magicLink }}
      </button>

      <p class="fine">{{ msg().auth.fine }}</p>
    </form>
  `,
  styleUrl: './auth-card.scss',
})
export class AuthCard {
  protected readonly auth = inject(AuthStore);
  readonly #toaster = inject(Toaster);
  readonly #i18n = inject(I18n);

  protected readonly msg = this.#i18n.messages;

  protected readonly modes = computed<readonly { value: AuthMode; label: string }[]>(() => [
    { value: 'sign-in', label: this.msg().auth.signIn },
    { value: 'sign-up', label: this.msg().auth.createAccount },
  ]);

  protected readonly mode = signal<AuthMode>('sign-in');
  protected readonly email = signal('');
  protected readonly password = signal('');

  protected async submit(): Promise<void> {
    if (!this.email().trim()) return;
    try {
      await this.auth.withPassword(this.mode(), this.email().trim(), this.password());
      this.#toaster.success(
        this.mode() === 'sign-up' ? this.msg().toast.confirmInbox : this.msg().toast.signedIn,
      );
    } catch (error) {
      this.#toaster.error(this.#message(error));
    }
  }

  protected async magicLink(): Promise<void> {
    if (!this.email().trim()) {
      this.#toaster.error(this.msg().toast.emailFirst);
      return;
    }
    try {
      await this.auth.withMagicLink(this.email().trim());
      this.#toaster.success(this.msg().toast.magicLinkSent);
    } catch (error) {
      this.#toaster.error(this.#message(error));
    }
  }

  /** Supabase phrases its own errors in English; only the fallback is ours. */
  #message(error: unknown): string {
    return error instanceof Error ? error.message : this.msg().toast.genericError;
  }
}
