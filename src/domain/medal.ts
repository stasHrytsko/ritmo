import type { RoutineCompletion, RoutineSnapshot } from './types';
import { isoWeekday } from './time';

export interface RoutineDayState {
  routine: RoutineSnapshot;
  scheduled: boolean;
  done: boolean;
  satisfied: boolean;
}

export const getRoutineDayStates = (
  routines: RoutineSnapshot[],
  completions: RoutineCompletion[],
  date: Date
): RoutineDayState[] => {
  const weekday = isoWeekday(date);
  const completionByRoutine = new Map(completions.map((item) => [item.routineId, item]));

  return routines
    .filter((routine) => routine.active)
    .map((routine) => {
      const scheduled = routine.weekdays.includes(weekday);
      const done = completionByRoutine.get(routine.routineId)?.done === true;
      return {
        routine,
        scheduled,
        done,
        satisfied: scheduled ? done : true
      };
    });
};

export const hasDayMedal = (states: RoutineDayState[]) =>
  states.length > 0 && states.every((state) => state.satisfied);
