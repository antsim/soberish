import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MINUTE } from '../../../core/bac/bac';
import { PaceProjection } from '../../../core/bac/pace';
import { I18n } from '../../../core/i18n/i18n.service';
import { formatClock, formatPermille } from '../../../shared/util/format';

/**
 * Where the night is heading if nothing changes.
 *
 * Sits under the hero number as its counterpart: that one says where you are,
 * this one says where you are going. Drawn dashed and tinted by the band it
 * predicts, because an extrapolation is a much bigger guess than the current
 * estimate and must not borrow its authority.
 */
@Component({
  selector: 'app-pace-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="note" [style.--band]="'var(--' + projection().status + ')'" aria-live="polite">
      <p class="line">
        <span class="icon" aria-hidden="true">{{ icon() }}</span>
        {{ headline() }}
      </p>
      <p class="evidence">{{ evidence() }}</p>
    </div>
  `,
  styleUrl: './pace-note.scss',
})
export class PaceNote {
  readonly projection = input.required<PaceProjection>();

  protected readonly msg = inject(I18n).messages;

  protected readonly icon = computed(
    () =>
      ({ sober: '💧', buzzed: '😏', merry: '🍻', drunk: '🥴', wasted: '🫠' })[
        this.projection().status
      ],
  );

  /**
   * A ceiling about to be crossed outranks the destination — it is the thing
   * you can still do something about. Most people never set one, so the band
   * line is what this normally says.
   */
  protected readonly headline = computed(() => {
    const projection = this.projection();
    const words = this.msg().pace;
    const crossesAt = projection.crossesAt;

    if (crossesAt !== null) {
      return words.crossing(formatPermille(projection.bac), formatClock(crossesAt));
    }
    const permille = formatPermille(projection.bac);
    const clock = formatClock(projection.at);
    const status = projection.status === 'sober' ? 'buzzed' : projection.status;
    return words[status](permille, clock);
  });

  protected readonly evidence = computed(() => {
    const pace = this.projection().pace;
    return this.msg().pace.evidence(pace.drinks, Math.round(pace.windowMs / MINUTE));
  });
}
