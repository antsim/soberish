import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MINUTE, alcoholGrams, standardDrinks } from '../../../core/bac/bac';
import { I18n } from '../../../core/i18n/i18n.service';
import { DRINK_TYPES, PLAIN_ICONS, drinkTypeFor } from '../../../core/models/drink-types';
import {
  DEFAULT_DRINK_DURATION,
  DURATION_PRESETS,
  Drink,
  DrinkDraft,
  MAX_DRINK_DURATION,
} from '../../../core/models/drink.model';
import {
  DEFAULT_STOMACH,
  Profile,
  STOMACH_STATES,
  StomachState,
  WIDMARK_R,
} from '../../../core/models/profile.model';
import { DrinkLimitStore } from '../../../core/state/drink-limit-store';
import { StomachStore } from '../../../core/state/stomach-store';
import { DecimalField } from '../../../shared/ui/decimal-field';
import { Disclosure } from '../../../shared/ui/disclosure';
import { Sheet } from '../../../shared/ui/sheet';
import { mlToOz, ozToMl } from '../../../shared/util/format';
import { DrinkPlanner } from './drink-planner';
import { STOMACH_ICONS } from './stomach-picker';

const ICONS = [...DRINK_TYPES.map((type) => type.icon), ...PLAIN_ICONS];
/** The pours a Finnish bar actually serves: shot, wine, large wine, bottle, 0.4, pint, UK pint. */
const VOLUME_PRESETS_ML = [40, 120, 160, 330, 400, 500, 568];
/** 1.5, 5, 12, 16 and 19.2 US oz — shot, wine, can, US pint, imperial pint. */
const VOLUME_PRESETS_IMPERIAL_ML = [44, 148, 355, 473, 568];
const ABV_PRESETS = [0, 4.7, 5.5, 8, 12.5, 20, 40];

/**
 * Add / edit form for a single drink.
 *
 * Every control is chip-first with a numeric field as the escape hatch, and the
 * BAC impact is previewed live so the effect of a change is obvious before it
 * is saved.
 *
 * What a drink *is* — its name, size and strength — stays on screen, because
 * that changes with every log. Pace, food, time and the planner's ceiling are set
 * rarely and mostly left alone, so they fold into rows that still read out
 * their current value. The ceiling is the one that opens itself: unlike the
 * other two its panel holds a verdict ("wait 40 min") that the row's own
 * summary cannot carry.
 */
@Component({
  selector: 'app-drink-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalField, Disclosure, DrinkPlanner, FormsModule, Sheet],
  templateUrl: './drink-editor.html',
  styleUrl: './drink-editor.scss',
})
export class DrinkEditor implements OnInit {
  /** `null` when adding, the existing row when editing. */
  readonly drink = input<Drink | null>(null);
  readonly seed = input<DrinkDraft | null>(null);
  readonly profile = input.required<Profile>();

  readonly saved = output<DrinkDraft>();
  readonly removed = output<string>();
  readonly dismissed = output<void>();

  protected readonly msg = inject(I18n).messages;
  protected readonly fmt = inject(I18n).format;
  readonly #limits = inject(DrinkLimitStore);
  readonly #stomachNow = inject(StomachStore).state;

  protected readonly icons = ICONS;
  protected readonly abvPresets = ABV_PRESETS;
  protected readonly durationPresets = DURATION_PRESETS;
  protected readonly defaultStomach = DEFAULT_STOMACH;

  protected readonly label = signal(this.msg().editor.defaultName);
  protected readonly icon = signal('🍺');
  protected readonly volumeMl = signal(330);
  protected readonly abv = signal(4.7);
  protected readonly durationMinutes = signal(DEFAULT_DRINK_DURATION);
  protected readonly consumedAt = signal(Date.now());
  /** A new drink starts on whatever has been eaten by now. */
  protected readonly stomach = signal<StomachState>(this.#stomachNow());

  protected readonly isEdit = computed(() => this.drink() !== null);
  protected readonly imperial = computed(() => this.profile().units === 'imperial');
  protected readonly unitName = computed(() => (this.imperial() ? 'oz' : 'ml'));

  /** Volume in whatever unit the user thinks in. */
  protected readonly volumeInput = computed(() =>
    this.imperial() ? round(mlToOz(this.volumeMl()), 1) : Math.round(this.volumeMl()),
  );

  protected readonly volumeChips = computed(() =>
    (this.imperial() ? VOLUME_PRESETS_IMPERIAL_ML : VOLUME_PRESETS_ML).map((ml) => ({
      ml,
      text: this.fmt().volume(ml, this.profile().units),
    })),
  );

  readonly #grams = computed(() => alcoholGrams(this.volumeMl(), this.abv()));
  protected readonly units = computed(() => standardDrinks(this.volumeMl(), this.abv()));

  /** Peak blood alcohol this drink alone adds, once fully absorbed. */
  protected readonly bacImpact = computed(() => {
    const profile = this.profile();
    return (this.#grams() / (profile.weightKg * 1000 * WIDMARK_R[profile.bodyType])) * 100;
  });

  protected readonly timeLocal = computed(() => toLocalInput(this.consumedAt()));

  protected readonly minutesAgo = computed(() =>
    Math.max(0, Math.round((Date.now() - this.consumedAt()) / MINUTE)),
  );

  /** Anything inside a minute of the present reads as "now" to a drinker. */
  protected readonly isNow = computed(() => Date.now() - this.consumedAt() < MINUTE);

  protected readonly timeSummary = computed(() =>
    this.isNow() ? this.msg().editor.now : this.fmt().clock(this.consumedAt()),
  );

  protected readonly paceSummary = computed(() =>
    this.durationMinutes()
      ? this.msg().editor.minutes(this.durationMinutes())
      : this.msg().editor.inOneGo,
  );

  protected readonly paceChanged = computed(
    () => this.durationMinutes() !== DEFAULT_DRINK_DURATION,
  );

  protected readonly stomachOptions = computed(() => {
    const words = this.msg().stomach;
    return STOMACH_STATES.map((value) => ({
      value,
      label: words[value],
      icon: STOMACH_ICONS[value],
    }));
  });

  protected readonly stomachSummary = computed(() => this.msg().stomach[this.stomach()]);

  protected readonly hasLimit = computed(() => this.#limits.limit() !== null);

  protected readonly limitSummary = computed(() => {
    const limit = this.#limits.limit();
    return limit === null
      ? this.msg().planner.off
      : this.msg().planner.under(this.fmt().permille(limit));
  });

  ngOnInit(): void {
    const existing = this.drink() ?? this.seed();
    if (existing) {
      this.label.set(existing.label);
      this.icon.set(existing.icon);
      this.volumeMl.set(existing.volumeMl);
      this.abv.set(existing.abv);
      this.durationMinutes.set(existing.durationMinutes);
      this.consumedAt.set(existing.consumedAt);
      this.stomach.set(existing.stomach);
    }
  }

  /**
   * Choosing what the drink is fills in how it is usually poured. Only while
   * adding: on a drink already had, the icon is a relabel and must not rewrite
   * what was actually drunk.
   */
  protected pickType(icon: string): void {
    this.icon.set(icon);
    const type = drinkTypeFor(icon);
    if (!type || this.isEdit()) return;
    this.volumeMl.set(type.volumeMl);
    this.abv.set(type.abv);
    this.durationMinutes.set(type.durationMinutes);
    // A name the user typed is theirs; one we supplied follows the type.
    const names = this.msg().drinkTypes;
    const current = this.label().trim();
    if (!current || Object.values(names).includes(current)) this.label.set(names[type.key]);
  }

  protected setVolumeFromInput(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.volumeMl.set(clamp(this.imperial() ? ozToMl(value) : value, 1, 5000));
  }

  protected setAbv(value: number): void {
    if (!Number.isFinite(value)) return;
    this.abv.set(clamp(value, 0, 96));
  }

  protected setDuration(minutes: number): void {
    this.durationMinutes.set(clamp(Math.round(minutes), 0, MAX_DRINK_DURATION));
  }

  protected shiftTime(minutes: number): void {
    this.consumedAt.update((current) => Math.min(Date.now(), current + minutes * MINUTE));
  }

  protected setTimeFromInput(value: string): void {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) this.consumedAt.set(Math.min(Date.now(), parsed));
  }

  protected resetTime(): void {
    this.consumedAt.set(Date.now());
  }

  protected save(): void {
    this.saved.emit({
      label: this.label().trim() || this.msg().editor.fallbackName,
      icon: this.icon(),
      volumeMl: Math.round(this.volumeMl()),
      abv: round(this.abv(), 2),
      durationMinutes: this.durationMinutes(),
      consumedAt: this.consumedAt(),
      stomach: this.stomach(),
    });
  }

  protected remove(): void {
    const drink = this.drink();
    if (drink) this.removed.emit(drink.id);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** `datetime-local` wants a local-time ISO string with no timezone suffix. */
function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * MINUTE;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}
