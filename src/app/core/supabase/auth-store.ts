import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export type AuthMode = 'sign-in' | 'sign-up';

/** Authentication state, kept as signals so guards and headers stay declarative. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly #supabase = inject(SupabaseService);
  readonly #user = signal<AuthUser | null>(null);
  readonly #busy = signal(false);
  readonly #ready = signal(false);

  readonly available = this.#supabase.enabled;
  readonly user = this.#user.asReadonly();
  readonly busy = this.#busy.asReadonly();
  readonly ready = this.#ready.asReadonly();
  readonly signedIn = computed(() => this.#user() !== null);

  async init(): Promise<void> {
    const client = await this.#supabase.client();
    if (!client) {
      this.#ready.set(true);
      return;
    }
    const { data } = await client.auth.getSession();
    this.#user.set(toUser(data.session?.user));
    client.auth.onAuthStateChange((_event, session) => this.#user.set(toUser(session?.user)));
    this.#ready.set(true);
  }

  async withPassword(mode: AuthMode, email: string, password: string): Promise<void> {
    await this.#run(async (client) => {
      const { error } =
        mode === 'sign-up'
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    });
  }

  /** Passwordless sign-in; the link returns to wherever the app is deployed. */
  async withMagicLink(email: string): Promise<void> {
    await this.#run(async (client) => {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href.split('?')[0] },
      });
      if (error) throw new Error(error.message);
    });
  }

  async signOut(): Promise<void> {
    await this.#run(async (client) => {
      await client.auth.signOut();
    });
    this.#user.set(null);
  }

  async #run(
    work: (client: NonNullable<Awaited<ReturnType<SupabaseService['client']>>>) => Promise<void>,
  ) {
    const client = await this.#supabase.client();
    if (!client) throw new Error('Cloud sync is not configured for this deployment.');
    this.#busy.set(true);
    try {
      await work(client);
    } finally {
      this.#busy.set(false);
    }
  }
}

function toUser(user: { id: string; email?: string } | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? '' } : null;
}
