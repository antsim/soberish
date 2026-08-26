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
import { formatDuration } from '../../../shared/util/format';
import { DurationPipe } from '../../../shared/util/pipes';

const COUNT_MS = 720;

/** The hero number: BAC, its trend, and when it hits zero. */
@Component({
  selector: 'app-bac-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="status section-title">{{ statusTitle() }}</p>
    <p class="value tabular" [attr.aria-label]="ariaLabel()">
      <span aria-hidden="true">{{ shown().toFixed(3) }}</span>
      <span class="unit" aria-hidden="true">%</span>
    </p>
    <p class="trend">
      <span class="chip" [class.chip--rising]="rising()">
        {{ rising() ? '↑ still rising' : bac() > 0 ? '↓ coming down' : '— nothing on board' }}
      </span>
    </p>
    @if (msUntilSober(); as remaining) {
      <p class="sober">
        Sober in <strong class="tabular">{{ remaining | duration }}</strong> · {{ soberClock() }}
      </p>
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

  protected readonly shown = signal(0);
  #raf = 0;

  protected readonly msUntilSober = computed(() => {
    const target = this.soberAt();
    return target === null ? null : Math.max(0, target - this.now());
  });

  protected readonly soberClock = computed(() => {
    const target = this.soberAt();
    return target === null
      ? ''
      : new Date(target).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
  });

  protected readonly ariaLabel = computed(() => {
    const remaining = this.msUntilSober();
    const suffix = remaining === null ? '' : `, sober in ${formatDuration(remaining)}`;
    return `Blood alcohol content ${this.bac().toFixed(3)} percent${suffix}`;
  });

  constructor() {
    // Count towards the new value so the number rolls instead of snapping.
    effect(() => {
      const target = this.bac();
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
