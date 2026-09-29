import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18n } from '../../core/i18n/i18n.service';
import { SessionStore } from '../../core/state/session-store';
import { formatClock, formatNightDate } from '../../shared/util/format';
import { RecapAurora } from './recap-aurora';
import { RecapCurve } from './recap-curve';
import { RecapLineup } from './recap-lineup';
import { RecapPeak } from './recap-peak';
import { RecapStats } from './recap-stats';

/**
 * The night recap: one fullscreen card, laid out to be screenshotted and
 * dropped into the group chat the morning after.
 *
 * Deliberately a picture rather than a share link — there is nothing to host,
 * nothing to keep, and the card lives exactly as long as the session does.
 * Everything that is not the card (the close button, the hint) can be tapped
 * away so the screenshot comes out clean.
 */
@Component({
  selector: 'app-recap-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecapAurora, RecapCurve, RecapLineup, RecapPeak, RecapStats],
  host: {
    '(document:keydown.escape)': 'close()',
  },
  templateUrl: './recap-page.html',
  styleUrl: './recap-page.scss',
})
export class RecapPage {
  readonly #session = inject(SessionStore);
  readonly #i18n = inject(I18n);
  readonly #router = inject(Router);
  readonly #location = inject(Location);
  protected readonly msg = this.#i18n.messages;

  protected readonly recap = this.#session.recap;

  /** True once the buttons have been tapped away for a clean screenshot. */
  protected readonly clean = signal(false);

  protected readonly band = computed(() => this.recap()?.peakStatus ?? 'sober');

  protected readonly title = computed(() => {
    const recap = this.recap();
    return recap ? formatNightDate(recap.startedAt, this.#i18n.locale()) : '';
  });

  protected readonly hours = computed(() => {
    const recap = this.recap();
    return recap ? `${formatClock(recap.startedAt)} → ${formatClock(recap.endedAt)}` : '';
  });

  protected toggleClean(): void {
    this.clean.update((clean) => !clean);
  }

  protected close(): void {
    // Back where they came from when that was inside the app, so the browser's
    // own back gesture and this button agree; home when opened cold.
    if (this.#router.lastSuccessfulNavigation()?.previousNavigation) {
      this.#location.back();
    } else {
      void this.#router.navigateByUrl('/', { replaceUrl: true });
    }
  }
}
