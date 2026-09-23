import { describe, expect, it } from 'vitest';
import {
  addDays,
  plural,
  dayOfYear,
  daysBetween,
  daysInYear,
  daysLeftInYear,
  fromISODate,
  isoWeekday,
  logicalDay,
  logicalDayKey,
  toISODate,
  weekId,
  weekNumber,
  weekStart,
  weeksLeftInYear
} from './time';

// Tests run in Europe/Warsaw: DST starts 2026-03-29 and ends 2026-10-25.
const at = (iso: string) => new Date(iso);

describe('toISODate / fromISODate', () => {
  it('round-trips a local date', () => {
    expect(toISODate(fromISODate('2026-09-18'))).toBe('2026-09-18');
  });

  it('formats single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween(new Date(2026, 8, 14), new Date(2026, 8, 18))).toBe(4);
  });

  it('counts a 23-hour day as one day', () => {
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it('counts a 25-hour day as one day', () => {
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
  });

  it('is negative going backwards', () => {
    expect(daysBetween(new Date(2026, 8, 18), new Date(2026, 8, 14))).toBe(-4);
  });
});

describe('isoWeekday', () => {
  it('numbers Monday as 1 and Sunday as 7', () => {
    expect(isoWeekday(fromISODate('2026-09-14'))).toBe(1);
    expect(isoWeekday(fromISODate('2026-09-20'))).toBe(7);
  });
});

describe('weekStart / weekId', () => {
  it('starts weeks on Monday', () => {
    expect(toISODate(weekStart(fromISODate('2026-09-18')))).toBe('2026-09-14');
    expect(weekId(fromISODate('2026-09-20'))).toBe('2026-09-14');
    expect(weekId(fromISODate('2026-09-21'))).toBe('2026-09-21');
  });

  it('survives the spring-forward weekend', () => {
    expect(weekId(fromISODate('2026-03-29'))).toBe('2026-03-23');
    expect(weekId(fromISODate('2026-03-30'))).toBe('2026-03-30');
  });
});

describe('weekNumber', () => {
  it('matches ISO-8601 week numbers', () => {
    expect(weekNumber(fromISODate('2026-01-01'))).toBe(1);
    expect(weekNumber(fromISODate('2026-09-18'))).toBe(38);
    // 2027-01-03 is a Sunday, so it still belongs to 2026's last week.
    expect(weekNumber(fromISODate('2027-01-03'))).toBe(53);
    expect(weekNumber(fromISODate('2027-01-04'))).toBe(1);
  });

  it('does not drift across daylight saving', () => {
    expect(weekNumber(fromISODate('2026-06-15'))).toBe(25);
    expect(weekNumber(fromISODate('2026-11-02'))).toBe(45);
  });
});

describe('dayOfYear', () => {
  it('counts from one', () => {
    expect(dayOfYear(fromISODate('2026-01-01'))).toBe(1);
    expect(dayOfYear(fromISODate('2026-12-31'))).toBe(365);
  });

  it('stays correct in the first hour of a summer day', () => {
    // The naive millisecond division this replaced was short by one here,
    // because summer time has swallowed an hour since January.
    expect(dayOfYear(at('2026-06-15T00:30:00+02:00'))).toBe(166);
    expect(dayOfYear(at('2026-06-15T23:30:00+02:00'))).toBe(166);
  });

  it('handles a leap year', () => {
    expect(dayOfYear(fromISODate('2028-12-31'))).toBe(366);
  });
});

describe('daysInYear', () => {
  it('knows leap years', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
  });
});

describe('daysLeftInYear / weeksLeftInYear', () => {
  it('excludes today and never goes negative', () => {
    expect(daysLeftInYear(fromISODate('2026-12-31'))).toBe(0);
    expect(daysLeftInYear(fromISODate('2026-12-30'))).toBe(1);
    expect(daysLeftInYear(fromISODate('2026-01-01'))).toBe(364);
  });

  it('rounds weeks up', () => {
    expect(weeksLeftInYear(fromISODate('2026-12-30'))).toBe(1);
    expect(weeksLeftInYear(fromISODate('2026-12-31'))).toBe(0);
  });
});

describe('logicalDay', () => {
  it('keeps the previous day before the boundary hour', () => {
    expect(logicalDayKey(at('2026-09-19T01:30:00+02:00'), 3)).toBe('2026-09-18');
    expect(logicalDayKey(at('2026-09-19T02:59:00+02:00'), 3)).toBe('2026-09-18');
  });

  it('switches at the boundary hour', () => {
    expect(logicalDayKey(at('2026-09-19T03:00:00+02:00'), 3)).toBe('2026-09-19');
    expect(logicalDayKey(at('2026-09-19T12:00:00+02:00'), 3)).toBe('2026-09-19');
  });

  it('falls back to plain midnight when the boundary is zero', () => {
    expect(logicalDayKey(at('2026-09-19T00:10:00+02:00'), 0)).toBe('2026-09-19');
  });

  it('returns the start of the day', () => {
    const day = logicalDay(at('2026-09-19T01:30:00+02:00'), 3);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(toISODate(addDays(fromISODate('2026-01-31'), 1))).toBe('2026-02-01');
  });

  it('crosses the spring-forward day without losing it', () => {
    expect(toISODate(addDays(fromISODate('2026-03-28'), 1))).toBe('2026-03-29');
    expect(toISODate(addDays(fromISODate('2026-03-29'), 1))).toBe('2026-03-30');
  });
});

describe('plural', () => {
  it.each([
    [1, 'день'], [2, 'дня'], [4, 'дня'], [5, 'дней'], [11, 'дней'], [12, 'дней'],
    [14, 'дней'], [21, 'день'], [22, 'дня'], [99, 'дней'], [101, 'день'], [111, 'дней']
  ])('%i → %s', (count, expected) => {
    expect(plural(count, ['день', 'дня', 'дней'])).toBe(expected);
  });
});
