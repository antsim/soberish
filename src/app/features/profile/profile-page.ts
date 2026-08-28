import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18n } from '../../core/i18n/i18n.service';
import { BodyType, PROFILE_LIMITS, UnitSystem } from '../../core/models/profile.model';
import { Connectivity } from '../../core/platform/connectivity';
import { PwaService } from '../../core/platform/pwa.service';
import { Toaster } from '../../core/platform/toaster';
import { DrinksStore } from '../../core/state/drinks-store';
import { ProfileStore } from '../../core/state/profile-store';
import { SessionStore } from '../../core/state/session-store';
import { DrinkSyncService } from '../../core/sync/drink-sync.service';
import { AuthStore } from '../../core/supabase/auth-store';
import { formatWeight, kgToLb, lbToKg } from '../../shared/util/format';
import { DurationPipe, PermillePipe } from '../../shared/util/pipes';
import { AuthCard } from '../auth/auth-card';

/** Body profile, account, install, and data controls. */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard, DurationPipe, FormsModule, PermillePipe],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  protected readonly profiles = inject(ProfileStore);
  protected readonly session = inject(SessionStore);
  protected readonly drinks = inject(DrinksStore);
  protected readonly auth = inject(AuthStore);
  protected readonly sync = inject(DrinkSyncService);
  protected readonly pwa = inject(PwaService);
  protected readonly network = inject(Connectivity);
  protected readonly i18n = inject(I18n);
  protected readonly msg = this.i18n.messages;
  readonly #toaster = inject(Toaster);

  protected readonly limits = PROFILE_LIMITS;

  protected readonly bodyTypes = computed<readonly { value: BodyType; label: string }[]>(() => [
    { value: 'female', label: this.msg().profile.female },
    { value: 'male', label: this.msg().profile.male },
    { value: 'unspecified', label: this.msg().profile.average },
  ]);

  protected readonly unitOptions = computed<readonly { value: UnitSystem; label: string }[]>(() => [
    { value: 'metric', label: this.msg().profile.metric },
    { value: 'imperial', label: this.msg().profile.imperial },
  ]);

  protected readonly imperial = computed(() => this.profiles.profile().units === 'imperial');

  /** Weight shown in the user's chosen unit. */
  protected readonly weightShown = computed(() => {
    const kg = this.profiles.profile().weightKg;
    return this.imperial() ? Math.round(kgToLb(kg)) : Math.round(kg);
  });

  /** Weight with its unit, for the slider's label. */
  protected readonly weightLabel = computed(() =>
    formatWeight(this.profiles.profile().weightKg, this.profiles.profile().units),
  );

  protected readonly weightRange = computed(() =>
    this.imperial()
      ? {
          min: Math.round(kgToLb(PROFILE_LIMITS.weightKg.min)),
          max: Math.round(kgToLb(PROFILE_LIMITS.weightKg.max)),
        }
      : PROFILE_LIMITS.weightKg,
  );

  protected readonly syncLabel = computed(() => {
    const messages = this.msg().profile;
    switch (this.sync.state()) {
      case 'off':
        return messages.syncLocalOnly;
      case 'syncing':
        return messages.syncSyncing;
      case 'error':
        return messages.syncRetrying;
      default:
        return this.auth.signedIn() ? messages.syncSynced : messages.syncSignIn;
    }
  });

  protected setWeight(value: number): void {
    if (!Number.isFinite(value)) return;
    void this.profiles.patch({ weightKg: this.imperial() ? lbToKg(value) : value });
  }

  protected patch(changes: Parameters<ProfileStore['patch']>[0]): void {
    void this.profiles.patch(changes);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.#toaster.show(this.msg().toast.signedOut);
  }

  protected async clearHistory(): Promise<void> {
    if (!this.drinks.count()) return;
    const confirmed = confirm(this.msg().profile.clearConfirm(this.drinks.count()));
    if (!confirmed) return;
    await this.drinks.clear();
    this.#toaster.show(this.msg().toast.sessionCleared);
  }

  protected exportJson(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: this.profiles.profile(),
      drinks: this.drinks.drinks(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `soberish-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected install(): void {
    void this.pwa.install();
  }
}
