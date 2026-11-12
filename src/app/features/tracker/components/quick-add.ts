import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n.service';
import { Icon } from '../../../shared/ui/icon';
import { DrinkPreset } from '../../../core/models/drink.model';
import { UnitSystem } from '../../../core/models/profile.model';

/**
 * The fast path: one tap logs a drink at the current time.
 *
 * Docked above the tab bar rather than placed in the page, because logging is
 * the one thing done all night and the page above it is taller than a phone —
 * in the flow it sat a full scroll away from the thumb.
 */
@Component({
  selector: 'app-quick-add',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="row" role="group" [attr.aria-label]="msg().quickAdd.group">
      <button type="button" class="preset preset--custom" (click)="customised.emit()">
        <app-icon class="preset__icon" name="plus" />
        <span class="preset__label">{{ msg().quickAdd.custom }}</span>
        <span class="preset__meta">{{ msg().quickAdd.customMeta }}</span>
      </button>
      @for (preset of presets(); track preset.id) {
        <button type="button" class="preset" (click)="picked.emit(preset)">
          <span class="preset__icon" aria-hidden="true">{{ preset.icon }}</span>
          <span class="preset__label">{{ preset.label }}</span>
          <span class="preset__meta tabular">
            {{ fmt().volume(preset.volumeMl, units()) }} · {{ fmt().abv(preset.abv) }}
          </span>
        </button>
      }
    </div>
  `,
  styleUrl: './quick-add.scss',
})
export class QuickAdd {
  protected readonly msg = inject(I18n).messages;
  protected readonly fmt = inject(I18n).format;

  readonly units = input.required<UnitSystem>();
  readonly presets = input.required<readonly DrinkPreset[]>();
  readonly picked = output<DrinkPreset>();
  readonly customised = output<void>();
}
