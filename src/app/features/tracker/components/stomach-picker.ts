import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n.service';
import { STOMACH_STATES, StomachState } from '../../../core/models/profile.model';
import { SessionStore } from '../../../core/state/session-store';
import { StomachStore } from '../../../core/state/stomach-store';

/**
 * "How much have you eaten tonight?"
 *
 * Food is the largest thing the Widmark maths cannot see from a body profile,
 * and the absorption slider that models it lives in settings where nobody
 * touches it mid-night. Three taps on the screen the drinker is already
 * looking at buys most of that accuracy back, and the resulting absorption
 * time is shown so the choice has a visible consequence rather than being an
 * article of faith.
 */
@Component({
  selector: 'app-stomach-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card' },
  template: `
    <div class="head">
      <h2 class="section-title">{{ msg().stomach.title }}</h2>
      <span class="effect tabular">{{ msg().stomach.effect(absorptionMinutes()) }}</span>
    </div>

    <div class="segmented" role="group" [attr.aria-label]="msg().stomach.title">
      @for (option of options(); track option.value) {
        <button
          type="button"
          [class.active]="state() === option.value"
          [attr.aria-pressed]="state() === option.value"
          (click)="choose(option.value)"
        >
          <span class="icon" aria-hidden="true">{{ option.icon }}</span>
          {{ option.label }}
        </button>
      }
    </div>

    <p class="hint">{{ msg().stomach.hint }}</p>
  `,
  styleUrl: './stomach-picker.scss',
})
export class StomachPicker {
  readonly #stomach = inject(StomachStore);
  readonly #session = inject(SessionStore);
  protected readonly msg = inject(I18n).messages;

  protected readonly state = this.#stomach.state;

  /** An empty plate, something small, a proper dinner. */
  protected readonly icons: Record<StomachState, string> = {
    empty: '🍽️',
    snack: '🥪',
    full: '🍝',
  };

  protected readonly options = computed(() => {
    const words = this.msg().stomach;
    return STOMACH_STATES.map((value) => ({
      value,
      label: words[value],
      icon: this.icons[value],
    }));
  });

  /** What the choice actually does to the curve, in the unit the slider uses. */
  protected readonly absorptionMinutes = computed(
    () => this.#session.curveProfile().absorptionMinutes,
  );

  protected choose(state: StomachState): void {
    void this.#stomach.set(state);
  }
}
