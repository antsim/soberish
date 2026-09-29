import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NightRecap } from '../../core/bac/recap';
import { I18n } from '../../core/i18n/i18n.service';

/** Two rows of emoji at most on a phone; past that it is a number, not a picture. */
const LINEUP_MAX = 18;

/** Every drink of the night as a row of emoji, and the one that got ordered most. */
@Component({
  selector: 'app-recap-lineup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recap-lineup.html',
  styleUrl: './recap-lineup.scss',
})
export class RecapLineup {
  readonly recap = input.required<NightRecap>();

  protected readonly msg = inject(I18n).messages;

  protected readonly shown = computed(() => {
    const drinks = this.recap().lineup;
    return {
      icons: drinks.slice(0, LINEUP_MAX),
      more: Math.max(0, drinks.length - LINEUP_MAX),
    };
  });
}
