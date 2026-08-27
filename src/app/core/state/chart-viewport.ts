import { HOUR, MINUTE } from '../bac/bac';

/** A visible time range on the chart. */
export interface TimeWindow {
  readonly from: number;
  readonly to: number;
}

/** Which slice of the session the user asked for. */
export type SpanChoice = number | 'session' | 'auto';

/** Zoomed all the way in, half an hour fills the width. */
export const MIN_SPAN_MS = 30 * MINUTE;

/** Sessions longer than this are worth zooming into by default. */
const COMFORTABLE_SPAN = 8 * HOUR;
/** What a long session opens at. */
const DEFAULT_LONG_SPAN = 6 * HOUR;
/** Share of the window kept ahead of "now" while following, so the
 *  projection is visible without pushing the recent past off-screen. */
const LOOKAHEAD = 0.22;

export function spanOf(window: TimeWindow): number {
  return window.to - window.from;
}

/**
 * Fits a window inside the session, preserving its span.
 *
 * Span is clamped first, so a window can never be wider than the session or
 * narrower than `MIN_SPAN_MS`; it is then slid — not squashed — back into
 * range, which is what keeps a drag against the edge from changing the zoom.
 */
export function clampWindow(window: TimeWindow, bounds: TimeWindow): TimeWindow {
  const maxSpan = Math.max(MIN_SPAN_MS, spanOf(bounds));
  const span = Math.min(Math.max(spanOf(window), MIN_SPAN_MS), maxSpan);

  let from = window.from;
  if (from + span > bounds.to) from = bounds.to - span;
  if (from < bounds.from) from = bounds.from;
  return { from, to: from + span };
}

/** A long session opens zoomed in; a short one opens whole. */
export function defaultSpan(bounds: TimeWindow): number {
  const total = spanOf(bounds);
  return total <= COMFORTABLE_SPAN ? total : DEFAULT_LONG_SPAN;
}

export function resolveSpan(choice: SpanChoice, bounds: TimeWindow): number {
  if (choice === 'session') return spanOf(bounds);
  if (choice === 'auto') return defaultSpan(bounds);
  return choice;
}

/** The window that tracks "now", with a little room ahead of it. */
export function autoWindow(span: number, now: number, bounds: TimeWindow): TimeWindow {
  const to = now + span * LOOKAHEAD;
  return clampWindow({ from: to - span, to }, bounds);
}

export function panWindow(window: TimeWindow, deltaMs: number, bounds: TimeWindow): TimeWindow {
  return clampWindow({ from: window.from + deltaMs, to: window.to + deltaMs }, bounds);
}

/**
 * Scales the window about a fixed point, given as a 0–1 position across it.
 *
 * Holding that point still is what makes pinch-to-zoom feel attached to the
 * fingers rather than to the middle of the chart.
 */
export function zoomWindow(
  window: TimeWindow,
  factor: number,
  focusRatio: number,
  bounds: TimeWindow,
): TimeWindow {
  const span = spanOf(window);
  const maxSpan = Math.max(MIN_SPAN_MS, spanOf(bounds));
  const next = Math.min(Math.max(span / factor, MIN_SPAN_MS), maxSpan);
  const focus = window.from + span * Math.min(1, Math.max(0, focusRatio));
  const from = focus - next * Math.min(1, Math.max(0, focusRatio));
  return clampWindow({ from, to: from + next }, bounds);
}
