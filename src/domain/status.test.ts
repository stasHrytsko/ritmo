import { describe, expect, it } from 'vitest';
import { LATE_GRACE_MINUTES, routineStatus } from './status';
import { minutesIntoDay, routineMinutes } from './time';

const today = '2026-09-23';
const at = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

describe('routineStatus', () => {
  const base = { done: false, dayKey: today, todayKey: today, nowMinutes: at('17:17'), boundaryHour: 3 };

  it('is done whenever it was done, whatever the day', () => {
    expect(routineStatus({ ...base, done: true, time: '08:00' })).toBe('done');
    expect(routineStatus({ ...base, done: true, dayKey: '2026-09-21' })).toBe('done');
  });

  it('is ahead on a day still to come', () => {
    expect(routineStatus({ ...base, dayKey: '2026-09-25', time: '07:30' })).toBe('ahead');
  });

  it('is missed on a day already gone', () => {
    expect(routineStatus({ ...base, dayKey: '2026-09-22', time: '23:00' })).toBe('missed');
    expect(routineStatus({ ...base, dayKey: '2026-09-22' })).toBe('missed');
  });

  it('keeps an anytime routine open until the day ends', () => {
    expect(routineStatus({ ...base, nowMinutes: at('23:59') })).toBe('ahead');
  });

  it('is due from its time until the grace runs out', () => {
    expect(routineStatus({ ...base, time: '17:17' })).toBe('due');
    expect(routineStatus({ ...base, time: '17:10' })).toBe('due');
    expect(routineStatus({ ...base, time: '16:17' })).toBe('due');
  });

  it('is missed once it is more than the grace late', () => {
    expect(LATE_GRACE_MINUTES).toBe(60);
    expect(routineStatus({ ...base, time: '16:16' })).toBe('missed');
    expect(routineStatus({ ...base, time: '08:15' })).toBe('missed');
  });

  it('is ahead before its time', () => {
    expect(routineStatus({ ...base, time: '18:00' })).toBe('ahead');
  });

  it('reads the small hours as the end of the same day', () => {
    // 01:30 with a 03:00 boundary is still the 23rd: 23:00 is late, not early.
    const nowMinutes = minutesIntoDay(new Date(2026, 8, 24, 1, 30), 3);
    expect(routineStatus({ ...base, nowMinutes, time: '23:00' })).toBe('missed');
    // 00:45 belongs to the same night: 45 minutes late, so still due.
    expect(routineStatus({ ...base, nowMinutes, time: '00:45' })).toBe('due');
    expect(routineStatus({ ...base, nowMinutes, time: '02:45' })).toBe('ahead');
  });
});

describe('routineMinutes', () => {
  it('puts times before the boundary at the end of the day', () => {
    expect(routineMinutes('23:00', 3)).toBe(23 * 60);
    expect(routineMinutes('00:45', 3)).toBe(24 * 60 + 45);
    expect(routineMinutes('03:00', 3)).toBe(3 * 60);
  });
});

describe('minutesIntoDay', () => {
  it('counts from midnight during the day', () => {
    expect(minutesIntoDay(new Date(2026, 8, 23, 17, 17), 3)).toBe(17 * 60 + 17);
  });

  it('keeps counting past midnight until the boundary', () => {
    expect(minutesIntoDay(new Date(2026, 8, 24, 1, 30), 3)).toBe(25 * 60 + 30);
    expect(minutesIntoDay(new Date(2026, 8, 24, 3, 0), 3)).toBe(3 * 60);
  });
});
