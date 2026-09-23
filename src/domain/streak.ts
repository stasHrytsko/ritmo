import type { ISODate } from './types';

export interface Streak {
  /** Medal days in a row up to now. */
  current: number;
  /** The longest run ever, the current one included. */
  best: number;
}

/**
 * Runs of medal days. `days` is every tracked day in order, oldest first,
 * ending with today. Today not closed yet does not break the run — it is still
 * in progress — so the current streak then counts up to yesterday.
 */
export function streaks(days: Array<{ key: ISODate; medal: boolean }>, todayKey: ISODate): Streak {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = day.medal ? run + 1 : 0;
    best = Math.max(best, run);
  }

  let current = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (day.medal) {
      current += 1;
      continue;
    }
    if (day.key === todayKey) continue;
    break;
  }

  return { current, best: Math.max(best, current) };
}
