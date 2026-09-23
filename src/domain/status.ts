import type { ISODate } from './types';
import { routineMinutes } from './time';

export type RoutineStatus = 'done' | 'missed' | 'due' | 'ahead';

/**
 * How late a timed routine can be and still count as "now". Anything later
 * reads as missed; anything sooner would call a routine missed a minute after
 * its time, which is discouraging rather than useful.
 */
export const LATE_GRACE_MINUTES = 60;

/** Where one routine stands on one day. */
export function routineStatus({
  done,
  time,
  dayKey,
  todayKey,
  nowMinutes,
  boundaryHour
}: {
  done: boolean;
  /** "HH:mm" for a timed routine; absent for an anytime one. */
  time?: string;
  dayKey: ISODate;
  todayKey: ISODate;
  /** Minutes into the logical day, see minutesIntoDay. */
  nowMinutes: number;
  boundaryHour: number;
}): RoutineStatus {
  if (done) return 'done';
  if (dayKey > todayKey) return 'ahead';
  if (dayKey < todayKey) return 'missed';
  // An anytime routine can still be done until the day ends.
  if (!time) return 'ahead';
  const at = routineMinutes(time, boundaryHour);
  if (at < nowMinutes - LATE_GRACE_MINUTES) return 'missed';
  if (at <= nowMinutes) return 'due';
  return 'ahead';
}
