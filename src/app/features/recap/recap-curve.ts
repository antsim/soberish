import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { STATUS_CEILING } from '../../core/bac/bac';
import { NightRecap } from '../../core/bac/recap';
import { I18n } from '../../core/i18n/i18n.service';
import { formatClock, formatPermille, toPermille } from '../../shared/util/format';
import { spline } from '../../shared/util/spline';

/** SVG user units. The card scales the whole drawing, so these are proportions. */
const VIEW = { width: 340, height: 196 } as const;
const PLOT = { left: 8, right: 332, top: 34, bottom: 162 } as const;
/** Minimum gap between two drink emoji under the curve before one is dropped. */
const ICON_SPACING = 15;

/**
 * The curve's colour ramp, as promille stops: blue on the floor, through each
 * band's colour at the top of that band, to magenta in the wasted zone. Laid
 * out in user space, so a colour always means the same level whatever the
 * night's own peak — a mellow night never borrows the wasted colour.
 */
const RAMP: readonly { readonly at: number; readonly colour: string }[] = [
  { at: 0, colour: 'var(--sober)' },
  { at: toPermille(STATUS_CEILING.buzzed), colour: 'var(--buzzed)' },
  { at: toPermille(STATUS_CEILING.merry), colour: 'var(--merry)' },
  { at: toPermille(STATUS_CEILING.drunk), colour: 'var(--drunk)' },
  { at: 2, colour: 'var(--wasted)' },
];

/**
 * The whole night as one line, drawn in on arrival.
 *
 * Unlike the live chart there is nothing to pan or morph, so this draws in
 * fixed user units and lets the SVG scale — the card is the only thing it has
 * to fit.
 */
@Component({
  selector: 'app-recap-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recap-curve.html',
  styleUrl: './recap-curve.scss',
})
export class RecapCurve {
  readonly recap = input.required<NightRecap>();

  readonly #msg = inject(I18n).messages;

  protected readonly view = VIEW;
  protected readonly plot = PLOT;

  /** Everything the SVG needs, in user units. */
  protected readonly drawn = computed(() => drawCurve(this.recap()));

  protected readonly label = computed(() => {
    const recap = this.recap();
    return this.#msg().recap.chartAria(
      formatPermille(recap.peak),
      formatClock(recap.startedAt),
      formatClock(recap.endedAt),
    );
  });

  protected readonly peakCaption = computed(() =>
    this.#msg().recap.peakAt(formatClock(this.recap().peakAt)),
  );
}

function drawCurve(recap: NightRecap) {
  const peak = toPermille(recap.peak);
  // Headroom above the peak for its label; a floor so a single beer is not
  // stretched into a mountain.
  const max = Math.max(0.4, peak * 1.12);
  const span = recap.to - recap.from || 1;
  const toX = (t: number) =>
    PLOT.left + (PLOT.right - PLOT.left) * Math.min(1, Math.max(0, (t - recap.from) / span));
  const toY = (permille: number) =>
    PLOT.bottom - ((PLOT.bottom - PLOT.top) * Math.min(permille, max)) / max;

  const points = recap.points.map((point) => ({
    x: toX(point.t),
    y: toY(toPermille(point.bac)),
  }));
  const line = spline(points);

  let lastIconX = Number.NEGATIVE_INFINITY;
  const markers = recap.lineup.flatMap((drink, index) => {
    const x = toX(drink.at);
    if (x - lastIconX < ICON_SPACING) return [];
    lastIconX = x;
    return [{ key: index, x, icon: drink.icon }];
  });

  const peakX = toX(recap.peakAt);
  return {
    line,
    area: `${line} L ${PLOT.right} ${PLOT.bottom} L ${PLOT.left} ${PLOT.bottom} Z`,
    // The ramp's top stop sits at 2 ‰; wherever that lands, above the plot or
    // not, is where the gradient ends.
    gradientTop: toYUnclamped(RAMP.at(-1)!.at, max),
    ramp: RAMP.map((stop) => ({ offset: stop.at / RAMP.at(-1)!.at, colour: stop.colour })),
    peak: {
      x: peakX,
      y: toY(peak),
      labelX: Math.min(PLOT.right - 26, Math.max(PLOT.left + 26, peakX)),
    },
    markers,
  };
}

function toYUnclamped(permille: number, max: number): number {
  return PLOT.bottom - ((PLOT.bottom - PLOT.top) * permille) / max;
}
