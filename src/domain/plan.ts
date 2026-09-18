import type { ISODate, RoutinePlanRevision, RoutineSnapshot, WeekRecord } from './types';

/** The plan a given day was actually judged against. */
export const planForDate = (week: WeekRecord, date: ISODate): RoutineSnapshot[] => {
  let best: RoutinePlanRevision | undefined;
  for (const revision of week.routinePlan) {
    if (revision.appliesFrom > date) continue;
    if (!best || revision.appliesFrom > best.appliesFrom) best = revision;
  }
  return best?.routines ?? [];
};

/** Every routine that appears anywhere in the week, latest version winning. */
export const routinesInWeek = (week: WeekRecord): RoutineSnapshot[] => {
  const byId = new Map<string, RoutineSnapshot>();
  for (const revision of [...week.routinePlan].sort((a, b) => a.appliesFrom.localeCompare(b.appliesFrom))) {
    for (const routine of revision.routines) byId.set(routine.routineId, routine);
  }
  return [...byId.values()];
};

/**
 * Applies a new plan from `appliesFrom` onwards. Revisions covering earlier
 * days are left untouched, which is what keeps past medals stable.
 */
export const withPlanRevision = (
  week: WeekRecord,
  appliesFrom: ISODate,
  routines: RoutineSnapshot[]
): WeekRecord => {
  const from = appliesFrom < week.startDate ? week.startDate : appliesFrom;
  const revisions = week.routinePlan
    .filter((revision) => revision.appliesFrom < from)
    .concat({ appliesFrom: from, routines })
    .sort((a, b) => a.appliesFrom.localeCompare(b.appliesFrom));

  return { ...week, routinePlan: revisions };
};
