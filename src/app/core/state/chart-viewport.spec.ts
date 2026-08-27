import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../bac/bac';
import {
  MIN_SPAN_MS,
  TimeWindow,
  autoWindow,
  clampWindow,
  defaultSpan,
  panWindow,
  resolveSpan,
  spanOf,
  zoomWindow,
} from './chart-viewport';

const T0 = Date.UTC(2026, 0, 1, 20, 0, 0);
const bounds: TimeWindow = { from: T0, to: T0 + 16 * HOUR };

describe('clampWindow', () => {
  it('leaves a window that already fits', () => {
    const window = { from: T0 + HOUR, to: T0 + 4 * HOUR };
    expect(clampWindow(window, bounds)).toEqual(window);
  });

  it('slides a window back into range without changing its span', () => {
    const clamped = clampWindow({ from: T0 - 5 * HOUR, to: T0 - 2 * HOUR }, bounds);
    expect(clamped.from).toBe(bounds.from);
    expect(spanOf(clamped)).toBe(3 * HOUR);
  });

  it('slides back from the far edge too', () => {
    const clamped = clampWindow({ from: T0 + 20 * HOUR, to: T0 + 23 * HOUR }, bounds);
    expect(clamped.to).toBe(bounds.to);
    expect(spanOf(clamped)).toBe(3 * HOUR);
  });

  it('never exceeds the session', () => {
    const clamped = clampWindow({ from: T0 - HOUR, to: T0 + 40 * HOUR }, bounds);
    expect(clamped).toEqual(bounds);
  });

  it('never goes below the minimum span', () => {
    const clamped = clampWindow({ from: T0, to: T0 + MINUTE }, bounds);
    expect(spanOf(clamped)).toBe(MIN_SPAN_MS);
  });

  it('copes with a session shorter than the minimum span', () => {
    const tiny = { from: T0, to: T0 + 5 * MINUTE };
    const clamped = clampWindow({ from: T0, to: T0 + HOUR }, tiny);
    expect(clamped.from).toBe(tiny.from);
    expect(spanOf(clamped)).toBe(MIN_SPAN_MS);
  });
});

describe('defaultSpan', () => {
  it('shows a short session whole', () => {
    const short = { from: T0, to: T0 + 5 * HOUR };
    expect(defaultSpan(short)).toBe(5 * HOUR);
  });

  it('zooms into a long one', () => {
    expect(defaultSpan(bounds)).toBe(6 * HOUR);
  });

  it('switches over at eight hours', () => {
    expect(defaultSpan({ from: T0, to: T0 + 8 * HOUR })).toBe(8 * HOUR);
    expect(defaultSpan({ from: T0, to: T0 + 8 * HOUR + MINUTE })).toBe(6 * HOUR);
  });
});

describe('resolveSpan', () => {
  it('maps the choices', () => {
    expect(resolveSpan(3 * HOUR, bounds)).toBe(3 * HOUR);
    expect(resolveSpan('session', bounds)).toBe(spanOf(bounds));
    expect(resolveSpan('auto', bounds)).toBe(defaultSpan(bounds));
  });
});

describe('autoWindow', () => {
  it('keeps now visible with room ahead of it', () => {
    const now = T0 + 8 * HOUR;
    const window = autoWindow(4 * HOUR, now, bounds);
    expect(window.from).toBeLessThan(now);
    expect(window.to).toBeGreaterThan(now);
    expect(spanOf(window)).toBe(4 * HOUR);
  });

  it('does not run off the end of the session', () => {
    const window = autoWindow(4 * HOUR, bounds.to, bounds);
    expect(window.to).toBe(bounds.to);
    expect(spanOf(window)).toBe(4 * HOUR);
  });

  it('shows everything when the span covers the session', () => {
    expect(autoWindow(spanOf(bounds), T0 + HOUR, bounds)).toEqual(bounds);
  });
});

describe('panWindow', () => {
  it('shifts by the delta', () => {
    const window = { from: T0 + 4 * HOUR, to: T0 + 8 * HOUR };
    expect(panWindow(window, HOUR, bounds).from).toBe(T0 + 5 * HOUR);
    expect(panWindow(window, -HOUR, bounds).from).toBe(T0 + 3 * HOUR);
  });

  it('stops at the edges instead of leaving the session', () => {
    const window = { from: T0, to: T0 + 4 * HOUR };
    expect(panWindow(window, -10 * HOUR, bounds)).toEqual(window);
  });
});

describe('zoomWindow', () => {
  const window: TimeWindow = { from: T0 + 4 * HOUR, to: T0 + 8 * HOUR };

  it('zooming in halves the span', () => {
    expect(spanOf(zoomWindow(window, 2, 0.5, bounds))).toBe(2 * HOUR);
  });

  it('zooming out doubles it', () => {
    expect(spanOf(zoomWindow(window, 0.5, 0.5, bounds))).toBe(8 * HOUR);
  });

  it('holds the focal instant still', () => {
    for (const ratio of [0, 0.25, 0.5, 1]) {
      const focus = window.from + spanOf(window) * ratio;
      const zoomed = zoomWindow(window, 2, ratio, bounds);
      expect(zoomed.from + spanOf(zoomed) * ratio, `ratio ${ratio}`).toBeCloseTo(focus, 0);
    }
  });

  it('cannot zoom past the whole session', () => {
    expect(zoomWindow(window, 0.01, 0.5, bounds)).toEqual(bounds);
  });

  it('cannot zoom below the minimum span', () => {
    expect(spanOf(zoomWindow(window, 1000, 0.5, bounds))).toBe(MIN_SPAN_MS);
  });

  it('stays inside the session when the focus is at an edge', () => {
    const zoomed = zoomWindow(bounds, 2, 0, bounds);
    expect(zoomed.from).toBeGreaterThanOrEqual(bounds.from);
    expect(zoomed.to).toBeLessThanOrEqual(bounds.to);
  });
});
