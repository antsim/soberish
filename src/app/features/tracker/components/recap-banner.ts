import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NightRecap } from '../../../core/bac/recap';
import { I18n } from '../../../core/i18n/i18n.service';
import { formatDuration, formatPermille } from '../../../shared/util/format';
import { spline } from '../../../shared/util/spline';

const SPARK = { width: 88, height: 40, pad: 3 } as const;

/**
 * The way into the night recap, on Tonight, from the moment BAC is back at
 * 0.00 ‰ until the session is wiped.
 *
 * It leads the page because the morning after is exactly when there is
 * nothing else on it worth looking at, and it says when it will be gone so
 * nobody is surprised when it is.
 */
@Component({
  selector: 'app-recap-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a
      class="banner"
      routerLink="/recap"
      [style.--band]="'var(--' + recap().peakStatus + ')'"
      [attr.aria-label]="msg().recap.bannerAria"
    >
      <svg
        class="spark"
        [attr.viewBox]="'0 0 ' + spark.width + ' ' + spark.height"
        [attr.width]="spark.width"
        [attr.height]="spark.height"
        aria-hidden="true"
      >
        <path class="spark__area" [attr.d]="path().area" />
        <path class="spark__line" [attr.d]="path().line" />
      </svg>
      <span class="text">
        <strong>{{ msg().recap.bannerTitle }}</strong>
        <span class="tabular">{{ summary() }}</span>
        @if (expiresIn()) {
          <span class="expires tabular">{{ expiresIn() }}</span>
        }
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  `,
  styleUrl: './recap-banner.scss',
})
export class RecapBanner {
  readonly recap = input.required<NightRecap>();
  /** Time until the retention wipe takes the recap with it. */
  readonly msUntilWipe = input<number | null>(null);

  protected readonly msg = inject(I18n).messages;
  protected readonly spark = SPARK;

  protected readonly summary = computed(() => {
    const recap = this.recap();
    const messages = this.msg();
    return messages.recap.bannerBody(
      formatPermille(recap.peak),
      formatDuration(recap.durationMs, messages.time),
    );
  });

  protected readonly expiresIn = computed(() => {
    const remaining = this.msUntilWipe();
    const messages = this.msg();
    return remaining === null
      ? ''
      : messages.recap.bannerExpires(formatDuration(remaining, messages.time));
  });

  protected readonly path = computed(() => {
    const { points, peak } = this.recap();
    const { width, height, pad } = SPARK;
    const max = peak || 1;
    const coords = points.map((point, index) => ({
      x: pad + ((width - 2 * pad) * index) / Math.max(1, points.length - 1),
      y: height - pad - ((height - 2 * pad) * point.bac) / max,
    }));
    const line = spline(coords);
    return {
      line,
      area: `${line} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`,
    };
  });
}
