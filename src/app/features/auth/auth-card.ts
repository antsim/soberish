import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
        @for (option of modes; track option.value) {
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
        <label for="auth-email">Email</label>
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
        <label for="auth-password">Password</label>
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
        {{ mode() === 'sign-up' ? 'Create account' : 'Sign in' }}
      </button>
      <button
        type="button"
        class="btn btn--ghost btn--block"
        [disabled]="auth.busy()"
        (click)="magicLink()"
      >
        Email me a magic link
      </button>

      <p class="fine">
        Your drinks stay on this device until you sign in. Signing in syncs them and puts you on the
        leaderboard — you can turn sharing off in <strong>You</strong>.
      </p>
    </form>
  `,
  styleUrl: './auth-card.scss',
})
export class AuthCard {
  protected readonly auth = inject(AuthStore);
  readonly #toaster = inject(Toaster);

  protected readonly modes: readonly { value: AuthMode; label: string }[] = [
    { value: 'sign-in', label: 'Sign in' },
    { value: 'sign-up', label: 'Create account' },
  ];

  protected readonly mode = signal<AuthMode>('sign-in');
  protected readonly email = signal('');
  protected readonly password = signal('');

  protected async submit(): Promise<void> {
    if (!this.email().trim()) return;
    try {
      await this.auth.withPassword(this.mode(), this.email().trim(), this.password());
      this.#toaster.success(
        this.mode() === 'sign-up' ? 'Check your inbox to confirm.' : 'Signed in.',
      );
    } catch (error) {
      this.#toaster.error(message(error));
    }
  }

  protected async magicLink(): Promise<void> {
    if (!this.email().trim()) {
      this.#toaster.error('Enter your email first.');
      return;
    }
    try {
      await this.auth.withMagicLink(this.email().trim());
      this.#toaster.success('Magic link sent — check your inbox.');
    } catch (error) {
      this.#toaster.error(message(error));
    }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
