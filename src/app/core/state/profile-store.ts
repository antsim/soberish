import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_PROFILE, PROFILE_LIMITS, Profile } from '../models/profile.model';
import { SoberishDb } from '../storage/soberish-db';

/** Owns the drinker's body profile and preferences, persisted to IndexedDB. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  readonly #db = inject(SoberishDb);
  readonly #profile = signal<Profile>(DEFAULT_PROFILE);
  readonly #loaded = signal(false);

  readonly profile = this.#profile.asReadonly();
  readonly loaded = this.#loaded.asReadonly();
  /** True until the user has confirmed their weight — drives the onboarding card. */
  readonly needsSetup = computed(() => this.#loaded() && this.#profile().updatedAt === 0);

  async load(): Promise<void> {
    const stored = await this.#db.readProfile();
    if (stored) this.#profile.set({ ...DEFAULT_PROFILE, ...stored });
    this.#loaded.set(true);
  }

  async patch(changes: Partial<Profile>): Promise<void> {
    const next = sanitize({ ...this.#profile(), ...changes, updatedAt: Date.now() });
    this.#profile.set(next);
    await this.#db.writeProfile(next);
  }
}

function clamp(
  value: number,
  { min, max }: { min: number; max: number },
  fallback: number,
): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitize(profile: Profile): Profile {
  return {
    ...profile,
    displayName: profile.displayName.trim().slice(0, 24),
    weightKg: clamp(profile.weightKg, PROFILE_LIMITS.weightKg, DEFAULT_PROFILE.weightKg),
    eliminationRate: clamp(
      profile.eliminationRate,
      PROFILE_LIMITS.eliminationRate,
      DEFAULT_PROFILE.eliminationRate,
    ),
    absorptionMinutes: clamp(
      profile.absorptionMinutes,
      PROFILE_LIMITS.absorptionMinutes,
      DEFAULT_PROFILE.absorptionMinutes,
    ),
  };
}
