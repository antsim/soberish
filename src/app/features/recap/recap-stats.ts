import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NightRecap } from '../../core/bac/recap';
import { I18n } from '../../core/i18n/i18n.service';
import { formatDuration } from '../../shared/util/format';

/** How much, how many, how long. */
@Component({
  selector: 'app-recap-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl>
      @for (stat of stats(); track stat.label) {
        <div class="stat">
          <dt>{{ stat.label }}</dt>
          <dd class="tabular">{{ stat.value }}</dd>
        </div>
      }
    </dl>
  `,
  styleUrl: './recap-stats.scss',
})
export class RecapStats {
  readonly recap = input.required<NightRecap>();

  protected readonly msg = inject(I18n).messages;

  protected readonly stats = computed(() => {
    const recap = this.recap();
    const messages = this.msg();
    return [
      { label: messages.recap.units, value: recap.units.toFixed(1) },
      { label: messages.recap.drinks, value: `${recap.drinkCount}` },
      { label: messages.recap.duration, value: formatDuration(recap.durationMs, messages.time) },
    ];
  });
}
