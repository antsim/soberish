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
import {
  DEFAULT_DRINK_DURATION,
  DURATION_PRESETS,
  Drink,
  DrinkDraft,
  MAX_DRINK_DURATION,
} from '../../../core/models/drink.model';
import { Profile, WIDMARK_R } from '../../../core/models/profile.model';
import { DecimalField } from '../../../shared/ui/decimal-field';
import { Sheet } from '../../../shared/ui/sheet';
import { PermillePipe } from '../../../shared/util/pipes';
import { mlToOz, ozToMl } from '../../../shared/util/format';
import { DrinkPlanner } from './drink-planner';

const ICONS = ['🍺', '🍻', '🍷', '🥃', '🍸', '🍹', '🥂', '🍎', '🧉', '💧'];
const VOLUME_PRESETS_ML = [40, 330, 400, 440, 500, 568];
const ABV_PRESETS = [0, 4.5, 5, 5.5, 8, 12, 20, 40];

/**
 * Add / edit form for a single drink.
 *
 * Every control is chip-first with a numeric field as the escape hatch, and the
 * BAC impact is previewed live so the effect of a change is obvious before it
 * is saved.
 */
@Component({
  selector: 'app-drink-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalField, DrinkPlanner, FormsModule, PermillePipe, Sheet],
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

  protected readonly icons = ICONS;
  protected readonly abvPresets = ABV_PRESETS;
  protected readonly durationPresets = DURATION_PRESETS;

  protected readonly label = signal(this.msg().editor.defaultName);
  protected readonly icon = signal('🍺');
  protected readonly volumeMl = signal(330);
  protected readonly abv = signal(4.7);
  protected readonly durationMinutes = signal(DEFAULT_DRINK_DURATION);
  protected readonly consumedAt = signal(Date.now());

  protected readonly isEdit = computed(() => this.drink() !== null);
  protected readonly imperial = computed(() => this.profile().units === 'imperial');

  /** Volume in whatever unit the user thinks in. */
  protected readonly volumeInput = computed(() =>
    this.imperial() ? round(mlToOz(this.volumeMl()), 1) : Math.round(this.volumeMl()),
  );

  protected readonly volumeChips = computed(() =>
    VOLUME_PRESETS_ML.map((ml) => ({
      ml,
      text: this.imperial() ? `${round(mlToOz(ml), 1)} oz` : `${ml} ml`,
    })),
  );

  protected readonly grams = computed(() => alcoholGrams(this.volumeMl(), this.abv()));
  protected readonly units = computed(() => standardDrinks(this.volumeMl(), this.abv()));

  /** Peak blood alcohol this drink alone adds, once fully absorbed. */
  protected readonly bacImpact = computed(() => {
    const profile = this.profile();
    return (this.grams() / (profile.weightKg * 1000 * WIDMARK_R[profile.bodyType])) * 100;
  });

  protected readonly timeLocal = computed(() => toLocalInput(this.consumedAt()));

  protected readonly minutesAgo = computed(() =>
    Math.max(0, Math.round((Date.now() - this.consumedAt()) / MINUTE)),
  );

  ngOnInit(): void {
    const existing = this.drink() ?? this.seed();
    if (existing) {
      this.label.set(existing.label);
      this.icon.set(existing.icon);
      this.volumeMl.set(existing.volumeMl);
      this.abv.set(existing.abv);
      this.durationMinutes.set(existing.durationMinutes);
      this.consumedAt.set(existing.consumedAt);
    }
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
