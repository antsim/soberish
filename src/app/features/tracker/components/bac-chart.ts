import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BacTimeline, HOUR, MINUTE } from '../../../core/bac/bac';
import { Drink } from '../../../core/models/drink.model';
import { toPermille } from '../../../shared/util/format';

const HEIGHT = 240;
/** Bottom padding holds two rows: drink markers, then the time axis. */
const PAD = { top: 18, right: 14, bottom: 48, left: 40 };
const TWEEN_MS = 720;

/**
 * One animatable snapshot of the curve. All fields interpolate linearly.
 *
 * Values are promille, converted once in `toFrame()`, so every measurement in
 * this component — axis ticks, grid steps, the plotted geometry — is in the
 * unit the axis is labelled with.
 */
interface Frame {
  readonly ys: readonly number[];
  readonly from: number;
  readonly to: number;
  readonly max: number;
}

interface Plot {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface Tick {
  readonly x: number;
  readonly label: string;
}

interface Marker {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly icon: string;
  readonly label: string;
}

/**
 * The BAC curve.
 *
 * Hand-rolled SVG rather than a charting library: the whole point is the
 * morph between two states, which is trivial here because `buildTimeline()`
 * always returns the same number of samples — old and new curves can be
 * interpolated index-for-index, so adding, editing, or deleting a drink
 * re-shapes the line instead of redrawing it.
 */
@Component({
  selector: 'app-bac-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bac-chart.html',
  styleUrl: './bac-chart.scss',
})
export class BacChart {
  readonly timeline = input.required<BacTimeline>();
  readonly drinks = input<readonly Drink[]>([]);
  readonly now = input.required<number>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly width = signal(360);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;

  readonly #displayed = signal<Frame>({ ys: [], from: 0, to: 1, max: 0.06 });
  #raf = 0;

  constructor() {
    effect(() => {
      const target = toFrame(this.timeline());
      untracked(() => this.#animate(target));
    });

    // Real pixel coordinates keep strokes and labels undistorted at any width.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(Math.max(240, Math.round(entry.contentRect.width))),
      );
      observer.observe(this.host().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });

    destroyRef.onDestroy(() => cancelAnimationFrame(this.#raf));
  }

  protected readonly plot = computed<Plot>(() => ({
    left: PAD.left,
    right: this.width() - PAD.right,
    top: PAD.top,
    bottom: HEIGHT - PAD.bottom,
    width: Math.max(1, this.width() - PAD.left - PAD.right),
    height: HEIGHT - PAD.top - PAD.bottom,
  }));

  /** Curve split at "now": solid behind, dashed projection ahead. */
  protected readonly paths = computed(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    if (frame.ys.length < 2) return { past: '', future: '', area: '' };

    const points = frame.ys.map((bac, index) => ({
      x: plot.left + (plot.width * index) / (frame.ys.length - 1),
      y: plot.bottom - (plot.height * Math.min(bac, frame.max)) / frame.max,
      t: frame.from + ((frame.to - frame.from) * index) / (frame.ys.length - 1),
    }));

    const nowX = this.#toX(this.now(), frame, plot);
    const past = points.filter((p) => p.x <= nowX);
    const future = points.filter((p) => p.x >= nowX);
    const nowY = interpolateY(points, nowX);
    const joint = { x: nowX, y: nowY, t: this.now() };

    const pastLine = spline([...past, joint]);
    const futureLine = spline([joint, ...future]);
    return {
      past: pastLine,
      future: futureLine,
      area: `${pastLine} L ${nowX.toFixed(1)} ${plot.bottom} L ${plot.left} ${plot.bottom} Z`,
    };
  });

  /** Rides the curve that is actually drawn, so it stays glued on mid-morph. */
  protected readonly nowPoint = computed(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    const x = this.#toX(this.now(), frame, plot);
    if (frame.ys.length < 2) return { x, y: plot.bottom };
    const points = frame.ys.map((bac, index) => ({
      x: plot.left + (plot.width * index) / (frame.ys.length - 1),
      y: plot.bottom - (plot.height * Math.min(bac, frame.max)) / (frame.max || 1),
    }));
    return { x, y: interpolateY(points, x) };
  });

  protected readonly gridLines = computed(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    const step = gridStep(frame.max);
    const decimals = step < 1 ? 2 : 1;
    const lines: { y: number; label: string }[] = [];
    for (let value = 0; value <= frame.max + 1e-9; value += step) {
      lines.push({
        y: plot.bottom - (plot.height * value) / frame.max,
        label: value.toFixed(decimals),
      });
    }
    return lines;
  });

  protected readonly timeTicks = computed<readonly Tick[]>(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    const span = frame.to - frame.from;
    const step =
      span <= 3 * HOUR
        ? 30 * MINUTE
        : span <= 8 * HOUR
          ? HOUR
          : span <= 20 * HOUR
            ? 2 * HOUR
            : 4 * HOUR;
    const ticks: Tick[] = [];
    const first = Math.ceil(frame.from / step) * step;
    for (let t = first; t <= frame.to; t += step) {
      ticks.push({ x: this.#toX(t, frame, plot), label: clockLabel(t) });
    }
    return ticks.filter((tick) => tick.x >= plot.left - 1 && tick.x <= plot.right + 1);
  });

  protected readonly markers = computed<readonly Marker[]>(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    return this.drinks()
      .filter((drink) => drink.consumedAt >= frame.from && drink.consumedAt <= frame.to)
      .map((drink) => ({
        id: drink.id,
        x: this.#toX(drink.consumedAt, frame, plot),
        y: plot.bottom + 6,
        icon: drink.icon,
        label: `${drink.label} at ${clockLabel(drink.consumedAt)}`,
      }));
  });

  protected readonly description = computed(() => {
    const timeline = this.timeline();
    const current = toPermille(timeline.current).toFixed(2);
    const peak = toPermille(timeline.peak).toFixed(2);
    return `Blood alcohol curve. Currently ${current} promille, session peak ${peak} promille.`;
  });

  #toX(t: number, frame: Frame, plot: Plot): number {
    const span = frame.to - frame.from || 1;
    const ratio = (t - frame.from) / span;
    return plot.left + plot.width * Math.min(1, Math.max(0, ratio));
  }

  /** Tweens from whatever is on screen to the new curve. */
  #animate(target: Frame): void {
    cancelAnimationFrame(this.#raf);
    const start = this.#displayed();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || start.ys.length !== target.ys.length) {
      this.#displayed.set(target);
      return;
    }

    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / TWEEN_MS);
      const eased = 1 - (1 - progress) ** 3;
      this.#displayed.set(lerpFrame(start, target, eased));
      if (progress < 1) this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }
}

function toFrame(timeline: BacTimeline): Frame {
  return {
    ys: timeline.points.map((point) => toPermille(point.bac)),
    from: timeline.from,
    to: timeline.to,
    max: niceMax(toPermille(Math.max(timeline.peak, timeline.current))),
  };
}

/** Rounds the axis up to a readable ceiling so the curve never touches the top. */
function niceMax(peakPermille: number): number {
  const target = Math.max(0.4, peakPermille * 1.25);
  const step = target <= 1 ? 0.2 : target <= 3 ? 0.5 : 1;
  return Math.ceil(target / step) * step;
}

function gridStep(maxPermille: number): number {
  return maxPermille <= 0.8 ? 0.2 : maxPermille <= 2 ? 0.5 : 1;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpFrame(a: Frame, b: Frame, t: number): Frame {
  return {
    ys: b.ys.map((value, index) => lerp(a.ys[index] ?? value, value, t)),
    from: lerp(a.from, b.from, t),
    to: lerp(a.to, b.to, t),
    max: lerp(a.max, b.max, t),
  };
}

/** Catmull-Rom to Bézier: smooth without the overshoot of a naive spline. */
function spline(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  const parts = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    );
  }
  return parts.join(' ');
}

function interpolateY(points: readonly { x: number; y: number }[], x: number): number {
  for (let i = 1; i < points.length; i++) {
    if (points[i].x >= x) {
      const a = points[i - 1];
      const b = points[i];
      const ratio = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return lerp(a.y, b.y, ratio);
    }
  }
  return points[points.length - 1]?.y ?? 0;
}

function clockLabel(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
