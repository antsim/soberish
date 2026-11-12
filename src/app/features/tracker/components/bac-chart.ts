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
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BacTimeline, HOUR, MINUTE, STATUS_CEILING, SoberStatus } from '../../../core/bac/bac';
import { I18n } from '../../../core/i18n/i18n.service';
import { Drink } from '../../../core/models/drink.model';
import { toPermille } from '../../../shared/util/format';
import { spline } from '../../../shared/util/spline';

const HEIGHT = 240;
/** Bottom padding holds two rows: drink markers, then the time axis. */
const PAD = { top: 18, right: 14, bottom: 48, left: 40 };
const TWEEN_MS = 720;
/** Minimum gap between two drink emoji before one is dropped. */
const ICON_SPACING = 15;
/** A band has to be this tall, in pixels, before its name fits inside it. */
const BAND_LABEL_HEIGHT = 16;

/** The bands with alcohol in them — the ones worth shading. */
type Band = Exclude<SoberStatus, 'sober'>;

/**
 * The status bands as promille ranges, bottom-up, tinted a little harder the
 * higher they sit — so the shape of the night reads before the numbers do.
 *
 * `wasted` is open-topped: whatever ceiling the axis has settled on is its top.
 */
const BANDS: readonly {
  readonly band: Band;
  readonly from: number;
  readonly to: number;
  readonly opacity: number;
}[] = [
  { band: 'buzzed', from: 0, to: toPermille(STATUS_CEILING.buzzed), opacity: 0.06 },
  {
    band: 'merry',
    from: toPermille(STATUS_CEILING.buzzed),
    to: toPermille(STATUS_CEILING.merry),
    opacity: 0.08,
  },
  {
    band: 'drunk',
    from: toPermille(STATUS_CEILING.merry),
    to: toPermille(STATUS_CEILING.drunk),
    opacity: 0.1,
  },
  {
    band: 'wasted',
    from: toPermille(STATUS_CEILING.drunk),
    to: Number.POSITIVE_INFINITY,
    opacity: 0.11,
  },
];

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
  /** False when a neighbour is too close for the emoji to be legible. */
  readonly showIcon: boolean;
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
  protected readonly msg = inject(I18n).messages;
  protected readonly fmt = inject(I18n).format;

  readonly timeline = input.required<BacTimeline>();
  readonly drinks = input<readonly Drink[]>([]);
  readonly now = input.required<number>();
  /** Whether pinch, wheel and arrow keys move the window. */
  readonly interactive = input(false);
  /** The planner's ceiling as a BAC percentage, drawn as a line when it is on the axis. */
  readonly limit = input<number | null>(null);

  /** Milliseconds to shift the visible window by. */
  readonly panned = output<number>();
  /** `factor` > 1 zooms in; `focusRatio` is the fixed point, 0–1 across the plot. */
  readonly zoomed = output<{ factor: number; focusRatio: number }>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly width = signal(360);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly bandLabelHeight = BAND_LABEL_HEIGHT;

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

  /**
   * Horizontal shading for the status bands, clipped to the visible range.
   *
   * Driven by `#displayed()` like everything else, so the bands grow and
   * shrink with the axis as the curve morphs instead of jumping.
   */
  protected readonly bands = computed(() => {
    const { max } = this.#displayed();
    const plot = this.plot();
    const names = this.msg().bands;
    const toY = (permille: number) =>
      plot.bottom - (plot.height * Math.min(permille, max)) / (max || 1);

    return BANDS.filter((band) => band.from < max).map((band) => {
      const top = toY(band.to);
      return {
        band: band.band,
        y: top,
        height: Math.max(0, toY(band.from) - top),
        colour: `var(--${band.band})`,
        opacity: band.opacity,
        label: names[band.band],
      };
    });
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
        label: this.fmt().decimal(value, decimals),
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
      ticks.push({ x: this.#toX(t, frame, plot), label: this.fmt().clock(t) });
    }
    return ticks.filter((tick) => tick.x >= plot.left - 1 && tick.x <= plot.right + 1);
  });

  protected readonly markers = computed<readonly Marker[]>(() => {
    const frame = this.#displayed();
    const plot = this.plot();
    // Zoomed out, a dozen drinks land on top of each other; keep every tick
    // but only draw an emoji where there is room for it to be read.
    let lastIconX = Number.NEGATIVE_INFINITY;
    return this.drinks()
      .filter((drink) => drink.consumedAt >= frame.from && drink.consumedAt <= frame.to)
      .sort((a, b) => a.consumedAt - b.consumedAt)
      .map((drink) => {
        const x = this.#toX(drink.consumedAt, frame, plot);
        const showIcon = x - lastIconX >= ICON_SPACING;
        if (showIcon) lastIconX = x;
        return {
          id: drink.id,
          x,
          y: plot.bottom + 6,
          icon: drink.icon,
          label: `${drink.label} · ${this.fmt().clock(drink.consumedAt)}`,
          showIcon,
        };
      });
  });

  /** The ceiling, when there is one and the axis reaches it. */
  protected readonly limitLine = computed(() => {
    const limit = this.limit();
    const { max } = this.#displayed();
    const plot = this.plot();
    if (limit === null) return null;
    const permille = toPermille(limit);
    if (permille <= 0 || permille >= max) return null;
    return {
      y: plot.bottom - (plot.height * permille) / max,
      label: this.msg().chart.limit(this.fmt().permille(limit)),
    };
  });

  /** Where the finger is, in SVG x. `null` when nothing is being read off. */
  readonly #scrubX = signal<number | null>(null);

  /**
   * The moment under the finger: its time and the curve's value there.
   *
   * Read off the displayed frame rather than recomputed, so the dot sits on
   * the line that is actually drawn.
   */
  protected readonly scrub = computed(() => {
    const at = this.#scrubX();
    const frame = this.#displayed();
    const plot = this.plot();
    if (at === null || frame.ys.length < 2 || this.timeline().peak <= 0) return null;

    const x = Math.min(plot.right, Math.max(plot.left, at));
    const ratio = (x - plot.left) / plot.width;
    const position = ratio * (frame.ys.length - 1);
    const index = Math.floor(position);
    const next = Math.min(frame.ys.length - 1, index + 1);
    const value = lerp(frame.ys[index], frame.ys[next], position - index);
    const t = frame.from + ratio * (frame.to - frame.from);
    const text = `${this.fmt().clock(t)} · ${this.fmt().decimal(value, 2)} ‰`;
    const width = text.length * 6.8 + 20;
    return {
      x,
      y: plot.bottom - (plot.height * Math.min(value, frame.max)) / frame.max,
      text,
      width,
      boxX: Math.min(this.width() - width - 2, Math.max(2, x - width / 2)),
    };
  });

  protected readonly description = computed(() => {
    const timeline = this.timeline();
    return this.msg().chart.aria(
      this.fmt().permille(timeline.current),
      this.fmt().permille(timeline.peak),
    );
  });

  // --- Gestures ------------------------------------------------------------
  //
  // Pointer events cover mouse, touch and pen in one path. One finger reads the
  // curve, because that is what a finger on a chart is asking for; moving the
  // window takes two (or the mouse, which has hover to read with). `touch-action:
  // pan-y` on the frame leaves vertical page scrolling to the browser, so
  // neither traps the page.

  readonly #pointers = new Map<number, { x: number; y: number }>();
  #pinchDistance = 0;
  #pinchMidX = 0;
  #gestureEndsAt = 0;

  /** True mid-gesture: the curve snaps rather than tweening, so drags track the finger. */
  #gesturing(): boolean {
    return this.#pointers.size > 0 || performance.now() < this.#gestureEndsAt;
  }

  protected onPointerDown(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size === 2) {
      this.#scrubX.set(null);
      this.#pinchDistance = this.#spread();
      this.#pinchMidX = this.#midpointX();
    } else if (event.pointerType !== 'mouse') {
      this.#scrubX.set(this.#localX(event.clientX));
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const previous = this.#pointers.get(event.pointerId);
    if (!previous) {
      // A mouse that is merely passing over reads the curve.
      if (event.pointerType === 'mouse') this.#scrubX.set(this.#localX(event.clientX));
      return;
    }
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.#pointers.size >= 2) {
      if (!this.interactive()) return;
      const spread = this.#spread();
      const midX = this.#midpointX();
      if (this.#pinchDistance > 0 && spread > 0) {
        this.zoomed.emit({
          factor: spread / this.#pinchDistance,
          focusRatio: this.#ratioAt(midX),
        });
      }
      // Two fingers travelling together move the window back or forward.
      const shift = midX - this.#pinchMidX;
      if (shift) this.panned.emit(-shift * this.#msPerPixel());
      this.#pinchDistance = spread;
      this.#pinchMidX = midX;
      return;
    }

    if (event.pointerType !== 'mouse') {
      this.#scrubX.set(this.#localX(event.clientX));
      return;
    }

    // Dragging right reveals earlier time, so the window moves back.
    const dx = event.clientX - previous.x;
    if (dx && this.interactive()) {
      this.#scrubX.set(null);
      this.panned.emit(-dx * this.#msPerPixel());
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    this.#pointers.delete(event.pointerId);
    if (this.#pointers.size === 2) {
      this.#pinchDistance = this.#spread();
      this.#pinchMidX = this.#midpointX();
    } else {
      this.#pinchDistance = 0;
    }
    if (event.pointerType !== 'mouse') this.#scrubX.set(null);
    // Keep snapping briefly, so releasing a drag does not kick off a tween.
    this.#gestureEndsAt = performance.now() + 120;
  }

  protected onPointerLeave(): void {
    if (!this.#pointers.size) this.#scrubX.set(null);
  }

  protected onWheel(event: WheelEvent): void {
    // Only a pinch gesture zooms. A trackpad pinch arrives as a ctrl+wheel
    // event, so this covers it while leaving a plain scroll to the page —
    // hijacking the wheel would trap the page whenever the cursor crossed
    // the chart.
    if (!this.interactive() || !event.deltaY || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    this.#gestureEndsAt = performance.now() + 120;
    this.zoomed.emit({
      factor: Math.exp(-event.deltaY * 0.0015),
      focusRatio: this.#ratioAt(event.clientX),
    });
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    const step = (this.#displayed().to - this.#displayed().from) / 6;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => this.panned.emit(-step),
      ArrowRight: () => this.panned.emit(step),
      '+': () => this.zoomed.emit({ factor: 1.5, focusRatio: 0.5 }),
      '=': () => this.zoomed.emit({ factor: 1.5, focusRatio: 0.5 }),
      '-': () => this.zoomed.emit({ factor: 1 / 1.5, focusRatio: 0.5 }),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  #msPerPixel(): number {
    const frame = this.#displayed();
    return (frame.to - frame.from) / Math.max(1, this.plot().width);
  }

  #spread(): number {
    const [a, b] = [...this.#pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  #midpointX(): number {
    const [a, b] = [...this.#pointers.values()];
    return (a.x + b.x) / 2;
  }

  /** A client x in the SVG's own coordinates, which are real pixels. */
  #localX(clientX: number): number {
    return clientX - this.host().nativeElement.getBoundingClientRect().left;
  }

  /** Turns a client x into a 0–1 position across the plot area. */
  #ratioAt(clientX: number): number {
    const box = this.host().nativeElement.getBoundingClientRect();
    const plot = this.plot();
    const x = clientX - box.left - plot.left;
    return Math.min(1, Math.max(0, x / Math.max(1, plot.width)));
  }

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

    if (reduced || this.#gesturing() || start.ys.length !== target.ys.length) {
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
