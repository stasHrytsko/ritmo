import { describe, expect, it } from 'vitest';
import { streaks } from './streak';

const run = (pattern: string) =>
  [...pattern].map((mark, index) => ({ key: `2026-09-${String(index + 1).padStart(2, '0')}`, medal: mark === 'x' }));

describe('streaks', () => {
  it('counts the run ending today', () => {
    const days = run('..xxx');
    expect(streaks(days, days[4].key)).toEqual({ current: 3, best: 3 });
  });

  it('does not break the run while today is still open', () => {
    const days = run('.xxxx.');
    expect(streaks(days, days[5].key)).toEqual({ current: 4, best: 4 });
  });

  it('breaks on a missed day before today', () => {
    const days = run('xxx.x.');
    expect(streaks(days, days[5].key)).toEqual({ current: 1, best: 3 });
  });

  it('is zero when yesterday was missed and today is open', () => {
    const days = run('xx..');
    expect(streaks(days, days[3].key)).toEqual({ current: 0, best: 2 });
  });

  it('keeps the best run from the past', () => {
    const days = run('xxxxxx.xx');
    expect(streaks(days, days[8].key)).toEqual({ current: 2, best: 6 });
  });

  it('handles no history', () => {
    expect(streaks([], '2026-09-01')).toEqual({ current: 0, best: 0 });
  });
});
