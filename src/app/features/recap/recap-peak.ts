import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NightRecap } from '../../core/bac/recap';
import { I18n } from '../../core/i18n/i18n.service';
import { formatPermille, toPermille } from '../../shared/util/format';

const COUNT_MS = 1400;

/** The night's peak, big, with the band it reached and a one-line verdict. */
@Component({
  selector: 'app-recap-peak',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="label">{{ msg().recap.peak }}</p>
    <p class="value tabular" [attr.aria-label]="peakLabel() + ' ‰'">
      <span aria-hidden="true">{{ shown().toFixed(2) }}</span>
      <span class="unit" aria-hidden="true">‰</span>
    </p>
    <p class="verdict">
      <span class="badge">{{ msg().status[band()].title }}</span>
      <span>{{ msg().recap.verdict[band()] }}</span>
    </p>
  `,
  styleUrl: './recap-peak.scss',
})
export class RecapPeak {
  readonly recap = input.required<NightRecap>();

  protected readonly msg = inject(I18n).messages;
  protected readonly band = computed(() => this.recap().peakStatus);
  protected readonly peakLabel = computed(() => formatPermille(this.recap().peak));

  /** The number on screen, which counts up to the peak on arrival. */
  protected readonly shown = signal(0);
  #raf = 0;

  constructor() {
    // Rolling up from zero is the reveal — the one moment the card is for.
    effect(() => {
      const target = toPermille(this.recap().peak);
      untracked(() => this.#countTo(target));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.#raf));
  }

  #countTo(target: number): void {
    cancelAnimationFrame(this.#raf);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.shown.set(target);
      return;
    }
    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / COUNT_MS);
      const eased = 1 - (1 - progress) ** 4;
      this.shown.set(target * eased);
      if (progress < 1) this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }
}
