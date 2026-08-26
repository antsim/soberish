import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DRINK_PRESETS, DrinkPreset } from '../../../core/models/drink.model';
import { UnitSystem } from '../../../core/models/profile.model';
import { VolumePipe } from '../../../shared/util/pipes';

/**
 * The fast path: one tap logs a drink at the current time.
 *
 * Anything unusual goes through "Custom", which opens the full editor — but
 * the common case never leaves this row.
 */
@Component({
  selector: 'app-quick-add',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VolumePipe],
  template: `
    <div class="row" role="group" aria-label="Log a drink">
      @for (preset of presets; track preset.id) {
        <button type="button" class="preset" (click)="picked.emit(preset)">
          <span class="preset__icon" aria-hidden="true">{{ preset.icon }}</span>
          <span class="preset__label">{{ preset.label }}</span>
          <span class="preset__meta tabular">
            {{ preset.volumeMl | volume: units() }} · {{ preset.abv }}%
          </span>
        </button>
      }
      <button type="button" class="preset preset--custom" (click)="customised.emit()">
        <span class="preset__icon" aria-hidden="true">✚</span>
        <span class="preset__label">Custom</span>
        <span class="preset__meta">Any size</span>
      </button>
    </div>
  `,
  styleUrl: './quick-add.scss',
})
export class QuickAdd {
  readonly units = input.required<UnitSystem>();
  readonly picked = output<DrinkPreset>();
  readonly customised = output<void>();

  protected readonly presets = DRINK_PRESETS;
}
