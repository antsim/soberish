import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MINUTE } from '../../../core/bac/bac';
import { PaceProjection } from '../../../core/bac/pace';
import { I18n } from '../../../core/i18n/i18n.service';
import { formatDuration, formatPermille } from '../../../shared/util/format';

/**
 * Where the night is heading if nothing changes.
 *
 * Sits under the hero number as its counterpart: that one says where you are,
 * this one says where you are going. Drawn dashed and tinted by the band it
 * predicts, because an extrapolation is a much bigger guess than the current
 * estimate and must not borrow its authority.
 *
 * Every horizon is spoken as a distance, never a wall clock. The projection
 * runs to a fixed offset, so printing it as a time of day invents a landmark
 * nothing actually happens at — and one that creeps forward every tick.
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
  readonly now = input.required<number>();

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
      const away = formatDuration(Math.max(0, crossesAt - this.now()), this.msg().time);
      return words.crossing(formatPermille(projection.bac), away);
    }
    const status = projection.status === 'sober' ? 'buzzed' : projection.status;
    return words[status](formatPermille(projection.bac));
  });

  protected readonly evidence = computed(() => {
    const pace = this.projection().pace;
    return this.msg().pace.evidence(pace.drinks, Math.round(pace.windowMs / MINUTE));
  });
}
