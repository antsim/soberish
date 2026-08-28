import { Injectable, computed, effect, inject } from '@angular/core';
import { ProfileStore } from '../state/profile-store';
import { Locale } from './locale';
import { Messages, en } from './messages.en';
import { fi } from './messages.fi';

const DICTIONARIES: Record<Locale, Messages> = { en, fi };

/**
 * The single source of UI copy.
 *
 * Components read `messages()` and index into it, so a renamed key breaks the
 * build instead of rendering an empty label, and switching language re-renders
 * every screen through the normal signal graph — no reload, no reactive glue.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly #profiles = inject(ProfileStore);

  readonly locale = computed<Locale>(() => this.#profiles.profile().locale);
  readonly messages = computed<Messages>(() => DICTIONARIES[this.locale()]);

  /** Language options for the settings picker, each labelled in its own language. */
  readonly options = Object.entries(DICTIONARIES).map(([value, messages]) => ({
    value: value as Locale,
    label: messages.languageName,
  }));

  constructor() {
    // Screen readers and `:lang()` rules need the document to agree.
    effect(() => (document.documentElement.lang = this.locale()));
  }

  setLocale(locale: Locale): void {
    void this.#profiles.patch({ locale });
  }
}
