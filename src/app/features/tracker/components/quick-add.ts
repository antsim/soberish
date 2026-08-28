import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DrinkPreset } from '../../../core/models/drink.model';
import { UnitSystem } from '../../../core/models/profile.model';
import { VolumePipe } from '../../../shared/util/pipes';

/**
 * The fast path: one tap logs a drink at the current time.
 *
 * The row is built from the drinks this user actually added through "Custom",
 * so the shortcuts are theirs rather than a guess at an average night out.
 */
@Component({
  selector: 'app-quick-add',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VolumePipe],
  template: `
    <div class="row" role="group" aria-label="Log a drink">
      <button type="button" class="preset preset--custom" (click)="customised.emit()">
        <span class="preset__icon" aria-hidden="true">✚</span>
        <span class="preset__label">Custom</span>
        <span class="preset__meta">Any size</span>
      </button>
      @for (preset of presets(); track preset.id) {
        <button type="button" class="preset" (click)="picked.emit(preset)">
          <span class="preset__icon" aria-hidden="true">{{ preset.icon }}</span>
          <span class="preset__label">{{ preset.label }}</span>
          <span class="preset__meta tabular">
            {{ preset.volumeMl | volume: units() }} · {{ preset.abv }}%
          </span>
        </button>
      } @empty {
        <p class="hint">Drinks you add with Custom show up here as shortcuts.</p>
      }
    </div>
  `,
  styleUrl: './quick-add.scss',
})
export class QuickAdd {
  readonly units = input.required<UnitSystem>();
  readonly presets = input.required<readonly DrinkPreset[]>();
  readonly picked = output<DrinkPreset>();
  readonly customised = output<void>();
}
