import { describe, expect, it } from 'vitest';
import { MINUTE } from '../bac/bac';
import { en } from '../i18n/messages.en';
import { Drink } from '../models/drink.model';
import {
  DRINK_REMINDER_DELAY,
  DRINK_REMINDER_GRACE,
  NOTIFICATION_RULES,
  NotificationContext,
  dueNotices,
  drinkReminder,
} from './notification-rules';

const START = Date.UTC(2026, 0, 1, 20, 0, 0);

function drink(id: string, minutesIn: number, durationMinutes: number): Drink {
  return {
    id,
    consumedAt: START + minutesIn * MINUTE,
    volumeMl: 330,
    abv: 4.7,
    durationMinutes,
    stomach: 'snack',
    label: 'Beer',
    icon: '🍺',
    createdAt: START,
    updatedAt: START,
    deleted: false,
    synced: false,
  };
}

const context = (...drinks: Drink[]): NotificationContext => ({ drinks });
const allOn = { enabled: () => true, delivered: new Set<string>() };

describe('drinkReminder', () => {
  it('has nothing to say before anything is logged', () => {
    expect(drinkReminder.schedule(context())).toBeNull();
  });

  it('is due 15 minutes after the drinking time runs out', () => {
    // 30 min to drink it, so the nudge lands 45 min after it was logged.
    const notice = drinkReminder.schedule(context(drink('a', 0, 30)));
    expect(notice?.at).toBe(START + 45 * MINUTE);
    expect(notice?.expiresAt).toBe(START + 45 * MINUTE + DRINK_REMINDER_GRACE);
  });

  it('treats a drink downed in one go the same way', () => {
    expect(drinkReminder.schedule(context(drink('a', 0, 0)))?.at).toBe(
      START + DRINK_REMINDER_DELAY,
    );
  });

  it('moves on to the next drink once one is logged', () => {
    const notice = drinkReminder.schedule(context(drink('a', 0, 30), drink('b', 40, 30)));
    expect(notice?.key).toBe('drinkReminder:b');
    expect(notice?.at).toBe(START + 85 * MINUTE);
  });

  it('follows the drink that finishes last, not the one logged last', () => {
    // A forgotten shot backdated into the middle of a long pint changes nothing.
    const notice = drinkReminder.schedule(context(drink('pint', 0, 60), drink('shot', 20, 0)));
    expect(notice?.key).toBe('drinkReminder:pint');
  });

  it('names the drink it is asking about', () => {
    const notice = drinkReminder.schedule(context(drink('a', 0, 30)));
    expect(notice?.text(en).body).toContain('Beer');
  });
});

describe('dueNotices', () => {
  const night = context(drink('a', 0, 30));
  const due = START + 45 * MINUTE;

  it('waits until the notice is due', () => {
    expect(dueNotices(NOTIFICATION_RULES, night, due - 1, allOn)).toEqual([]);
    expect(dueNotices(NOTIFICATION_RULES, night, due, allOn)).toHaveLength(1);
  });

  it('shows each notice only once', () => {
    const delivered = new Set(['drinkReminder:a']);
    expect(dueNotices(NOTIFICATION_RULES, night, due, { ...allOn, delivered })).toEqual([]);
  });

  it('drops a reminder that is too stale to be useful', () => {
    expect(dueNotices(NOTIFICATION_RULES, night, due + DRINK_REMINDER_GRACE, allOn)).toEqual([]);
  });

  it('skips kinds the user has switched off', () => {
    expect(dueNotices(NOTIFICATION_RULES, night, due, { ...allOn, enabled: () => false })).toEqual(
      [],
    );
  });
});
