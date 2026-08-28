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
import { SoberStatus } from '../../../core/bac/bac';
import { I18n } from '../../../core/i18n/i18n.service';
import { formatClock, formatDuration, toPermille } from '../../../shared/util/format';
import { DurationPipe } from '../../../shared/util/pipes';

const COUNT_MS = 720;

/** The hero number: BAC, its trend, and when it hits zero. */
@Component({
  selector: 'app-bac-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="status section-title">{{ statusTitle() }}</p>
    <p class="value tabular" [attr.aria-label]="ariaLabel()">
      <span aria-hidden="true">{{ shown().toFixed(2) }}</span>
      <span class="unit" aria-hidden="true">‰</span>
    </p>
    <p class="trend">
      <span class="chip" [class.chip--rising]="rising()">
        {{
          rising() ? msg().readout.rising : bac() > 0 ? msg().readout.falling : msg().readout.empty
        }}
      </span>
    </p>
    @if (msUntilSober(); as remaining) {
      <p class="sober">{{ msg().readout.soberIn(remaining | duration: msg(), soberClock()) }}</p>
    } @else {
      <p class="sober">{{ blurb() }}</p>
    }
  `,
  styleUrl: './bac-readout.scss',
  imports: [DurationPipe],
})
export class BacReadout {
  readonly bac = input.required<number>();
  readonly status = input.required<SoberStatus>();
  readonly statusTitle = input.required<string>();
  readonly blurb = input.required<string>();
  readonly rising = input.required<boolean>();
  readonly soberAt = input.required<number | null>();
  readonly now = input.required<number>();

  protected readonly msg = inject(I18n).messages;

  protected readonly shown = signal(0);
  #raf = 0;

  protected readonly msUntilSober = computed(() => {
    const target = this.soberAt();
    return target === null ? null : Math.max(0, target - this.now());
  });

  protected readonly soberClock = computed(() => {
    const target = this.soberAt();
    return target === null ? '' : formatClock(target);
  });

  protected readonly ariaLabel = computed(() => {
    const messages = this.msg();
    const remaining = this.msUntilSober();
    const suffix =
      remaining === null
        ? ''
        : messages.readout.ariaSoberIn(formatDuration(remaining, messages.time));
    return messages.readout.aria(toPermille(this.bac()).toFixed(2)) + suffix;
  });

  constructor() {
    // Count towards the new value so the number rolls instead of snapping.
    effect(() => {
      const target = toPermille(this.bac());
      untracked(() => this.#countTo(target));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.#raf));
  }

  #countTo(target: number): void {
    cancelAnimationFrame(this.#raf);
    const start = this.shown();
    if (
      Math.abs(target - start) < 0.0005 ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.shown.set(target);
      return;
    }
    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / COUNT_MS);
      const eased = 1 - (1 - progress) ** 3;
      this.shown.set(start + (target - start) * eased);
      if (progress < 1) this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }
}
