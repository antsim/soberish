import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CappedStatus, STATUS_CEILING, alcoholGrams, planDrink } from '../../../core/bac/bac';
import { I18n } from '../../../core/i18n/i18n.service';
import { Profile } from '../../../core/models/profile.model';
import { Clock } from '../../../core/platform/clock';
import { DrinkLimitStore, MAX_DRINK_LIMIT } from '../../../core/state/drink-limit-store';
import { DrinksStore } from '../../../core/state/drinks-store';
import { DecimalField } from '../../../shared/ui/decimal-field';
import {
  formatClock,
  formatDuration,
  formatPermille,
  fromPermille,
  toPermille,
} from '../../../shared/util/format';

/** The bands offered as one-tap ceilings, weakest first. */
const PRESETS = (Object.keys(STATUS_CEILING) as CappedStatus[]).map((band) => ({
  band,
  limit: STATUS_CEILING[band],
}));

type Tone = 'ok' | 'wait' | 'over';

/**
 * "When can I have this and still stay under X ‰?"
 *
 * Always answered from the current moment, never from the time set in the
 * editor above it: the question is about a drink not yet had, while that field
 * backdates one already drunk.
 */
@Component({
  selector: 'app-drink-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalField],
  template: `
    <p class="section-title">{{ msg().planner.title }}</p>

    <div class="chips" role="group" [attr.aria-label]="msg().planner.title">
      <button
        type="button"
        class="chip"
        [class.chip--active]="limit() === null"
        [attr.aria-pressed]="limit() === null"
        (click)="choose(null)"
      >
        {{ msg().planner.off }}
      </button>
      @for (preset of presets; track preset.band) {
        <button
          type="button"
          class="chip"
          [class.chip--active]="limit() === preset.limit"
          [attr.aria-pressed]="limit() === preset.limit"
          [style.--band]="'var(--' + preset.band + ')'"
          (click)="choose(preset.limit)"
        >
          {{ msg().planner.ceiling(msg().bands[preset.band], permille(preset.limit)) }}
        </button>
      }
    </div>

    @if (hasLimit()) {
      <div class="field">
        <label for="drink-limit">{{ msg().planner.exact }}</label>
        <app-decimal-field
          fieldId="drink-limit"
          [ariaLabel]="msg().planner.exactAria"
          [value]="limitPermille()"
          [maximumFractionDigits]="2"
          (valueChange)="setFromInput($event)"
        />
      </div>
    }

    @if (verdict(); as result) {
      <p class="verdict" [class]="'verdict--' + result.tone" aria-live="polite">
        <span class="verdict__icon" aria-hidden="true">{{ result.icon }}</span>
        <span>{{ result.text }}</span>
      </p>
      <p class="hint">{{ msg().planner.fromNow }}</p>
    }
  `,
  styleUrl: './drink-planner.scss',
})
export class DrinkPlanner {
  readonly profile = input.required<Profile>();
  readonly volumeMl = input.required<number>();
  readonly abv = input.required<number>();

  readonly #drinks = inject(DrinksStore);
  readonly #clock = inject(Clock);
  readonly #limits = inject(DrinkLimitStore);
  protected readonly msg = inject(I18n).messages;

  protected readonly presets = PRESETS;
  protected readonly limit = this.#limits.limit;

  protected readonly hasLimit = computed(() => this.limit() !== null);

  /** The active ceiling in the unit the chips and the field speak. */
  protected readonly limitPermille = computed(() => toPermille(this.limit() ?? 0));

  protected readonly verdict = computed<{ tone: Tone; icon: string; text: string } | null>(() => {
    const limit = this.limit();
    if (limit === null) return null;

    const messages = this.msg();
    if (alcoholGrams(this.volumeMl(), this.abv()) <= 0) {
      return { tone: 'ok', icon: '💧', text: messages.planner.noAlcohol };
    }

    const now = this.#clock.now();
    const plan = planDrink(
      this.#drinks.drinks(),
      this.profile(),
      { volumeMl: this.volumeMl(), abv: this.abv() },
      limit,
      now,
    );
    const peak = formatPermille(plan.peak);

    if (!plan.fits) {
      return plan.currentPeak > limit
        ? {
            tone: 'over',
            icon: '🚫',
            text: messages.planner.alreadyOver(formatPermille(plan.currentPeak)),
          }
        : { tone: 'over', icon: '🚫', text: messages.planner.tooBig(peak) };
    }
    if (plan.waitMs === 0) return { tone: 'ok', icon: '👍', text: messages.planner.goNow(peak) };
    return {
      tone: 'wait',
      icon: '⏳',
      text: messages.planner.wait(
        formatDuration(plan.waitMs, messages.time),
        formatClock(plan.at),
        peak,
      ),
    };
  });

  protected permille(bacPercent: number): string {
    return formatPermille(bacPercent);
  }

  protected choose(limit: number | null): void {
    void this.#limits.set(limit);
  }

  /** Typing never switches the planner off — clamping keeps the field on screen. */
  protected setFromInput(permille: number): void {
    if (!Number.isFinite(permille)) return;
    void this.#limits.set(Math.min(Math.max(fromPermille(permille), 0), MAX_DRINK_LIMIT));
  }
}
