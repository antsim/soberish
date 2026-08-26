import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodyType, PROFILE_LIMITS, UnitSystem } from '../../core/models/profile.model';
import { Connectivity } from '../../core/platform/connectivity';
import { PwaService } from '../../core/platform/pwa.service';
import { Toaster } from '../../core/platform/toaster';
import { DrinksStore } from '../../core/state/drinks-store';
import { ProfileStore } from '../../core/state/profile-store';
import { SessionStore } from '../../core/state/session-store';
import { DrinkSyncService } from '../../core/sync/drink-sync.service';
import { AuthStore } from '../../core/supabase/auth-store';
import { kgToLb, lbToKg } from '../../shared/util/format';
import { DurationPipe } from '../../shared/util/pipes';
import { AuthCard } from '../auth/auth-card';

/** Body profile, account, install, and data controls. */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard, DurationPipe, FormsModule],
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
  readonly #toaster = inject(Toaster);

  protected readonly limits = PROFILE_LIMITS;

  protected readonly bodyTypes: readonly { value: BodyType; label: string }[] = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'unspecified', label: 'Average' },
  ];

  protected readonly unitOptions: readonly { value: UnitSystem; label: string }[] = [
    { value: 'metric', label: 'ml / kg' },
    { value: 'imperial', label: 'oz / lb' },
  ];

  protected readonly imperial = computed(() => this.profiles.profile().units === 'imperial');

  /** Weight shown in the user's chosen unit. */
  protected readonly weightShown = computed(() => {
    const kg = this.profiles.profile().weightKg;
    return this.imperial() ? Math.round(kgToLb(kg)) : Math.round(kg);
  });

  protected readonly weightRange = computed(() =>
    this.imperial()
      ? {
          min: Math.round(kgToLb(PROFILE_LIMITS.weightKg.min)),
          max: Math.round(kgToLb(PROFILE_LIMITS.weightKg.max)),
        }
      : PROFILE_LIMITS.weightKg,
  );

  protected readonly syncLabel = computed(() => {
    switch (this.sync.state()) {
      case 'off':
        return 'Local only';
      case 'syncing':
        return 'Syncing…';
      case 'error':
        return 'Retrying…';
      default:
        return this.auth.signedIn() ? 'Synced' : 'Sign in to sync';
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
    this.#toaster.show('Signed out. Your drinks stay on this device.');
  }

  protected async clearHistory(): Promise<void> {
    if (!this.drinks.count()) return;
    const confirmed = confirm(`Delete all ${this.drinks.count()} drinks from this session?`);
    if (!confirmed) return;
    await this.drinks.clear();
    this.#toaster.show('Session cleared.');
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
