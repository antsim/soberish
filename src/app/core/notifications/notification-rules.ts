import { MINUTE } from '../bac/bac';
import type { Messages } from '../i18n/messages.en';
import { Drink } from '../models/drink.model';

/** Every kind of notification the app knows how to send. */
export type NotificationKind = 'drinkReminder';

/** What a rule gets to look at. Grows as new kinds need more than the drinks. */
export interface NotificationContext {
  readonly drinks: readonly Drink[];
}

/** One occurrence of a notification, scheduled for a moment in time. */
export interface Notice {
  readonly kind: NotificationKind;
  /**
   * Identity of this occurrence. Each key is shown at most once, so the key is
   * what decides whether an edit or a reload counts as "the same" reminder.
   */
  readonly key: string;
  readonly at: number;
  /**
   * Past this a reminder only gets in the way: anyone opening the app hours
   * later is already looking at what it would have told them.
   */
  readonly expiresAt: number;
  readonly text: (messages: Messages) => { readonly title: string; readonly body: string };
}

/**
 * A kind of notification: when it is due, worked out from state alone.
 *
 * Rules are pure and hold no timers. The scheduler re-asks them on every clock
 * tick, so a rule never has to know about reloads, edits or deletions — it
 * just answers for the state it is given.
 */
export interface NotificationRule {
  readonly kind: NotificationKind;
  schedule(context: NotificationContext): Notice | null;
}

/** How long after a drink should have been finished before asking about the next one. */
export const DRINK_REMINDER_DELAY = 15 * MINUTE;
export const DRINK_REMINDER_GRACE = 30 * MINUTE;

/**
 * Nudges the drinker when the last drink should be gone and nothing new has
 * been logged — the curve is only as good as the log behind it.
 *
 * Anchored to whichever drink *finishes* last rather than the last one logged,
 * so backdating a forgotten beer does not push the reminder around.
 */
export const drinkReminder: NotificationRule = {
  kind: 'drinkReminder',
  schedule({ drinks }) {
    let last: Drink | null = null;
    let finishedAt = -Infinity;
    for (const drink of drinks) {
      const end = drink.consumedAt + drink.durationMinutes * MINUTE;
      if (end >= finishedAt) {
        last = drink;
        finishedAt = end;
      }
    }
    if (!last) return null;
    const at = finishedAt + DRINK_REMINDER_DELAY;
    const { icon, label } = last;
    return {
      kind: 'drinkReminder',
      key: `drinkReminder:${last.id}`,
      at,
      expiresAt: at + DRINK_REMINDER_GRACE,
      text: (messages) => ({
        title: messages.notifications.drinkReminder.title,
        body: messages.notifications.drinkReminder.body(icon, label),
      }),
    };
  },
};

/** Registry, in the order the settings screen lists them. */
export const NOTIFICATION_RULES: readonly NotificationRule[] = [drinkReminder];

/** The notices that should be shown right now and have not been yet. */
export function dueNotices(
  rules: readonly NotificationRule[],
  context: NotificationContext,
  now: number,
  filter: {
    readonly enabled: (kind: NotificationKind) => boolean;
    readonly delivered: ReadonlySet<string>;
  },
): Notice[] {
  return rules
    .filter((rule) => filter.enabled(rule.kind))
    .map((rule) => rule.schedule(context))
    .filter(
      (notice): notice is Notice =>
        notice !== null &&
        !filter.delivered.has(notice.key) &&
        now >= notice.at &&
        now < notice.expiresAt,
    );
}
