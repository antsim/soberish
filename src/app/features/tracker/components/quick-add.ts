import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n.service';
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
    <div class="row" role="group" [attr.aria-label]="msg().quickAdd.group">
      <button type="button" class="preset preset--custom" (click)="customised.emit()">
        <span class="preset__icon" aria-hidden="true">✚</span>
        <span class="preset__label">{{ msg().quickAdd.custom }}</span>
        <span class="preset__meta">{{ msg().quickAdd.customMeta }}</span>
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
        <p class="hint">{{ msg().quickAdd.empty }}</p>
      }
    </div>
  `,
  styleUrl: './quick-add.scss',
})
export class QuickAdd {
  protected readonly msg = inject(I18n).messages;

  readonly units = input.required<UnitSystem>();
  readonly presets = input.required<readonly DrinkPreset[]>();
  readonly picked = output<DrinkPreset>();
  readonly customised = output<void>();
}
