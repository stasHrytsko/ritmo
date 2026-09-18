import { describe, expect, it } from 'vitest';
import { getRoutineDayStates, hasDayMedal } from './medal';
import { fromISODate } from './time';
import type { RoutineCompletion, RoutineSnapshot } from './types';

const monday = fromISODate('2026-09-14');
const saturday = fromISODate('2026-09-19');

const routine = (over: Partial<RoutineSnapshot> = {}): RoutineSnapshot => ({
  routineId: 'r1',
  name: 'Walk',
  active: true,
  weekdays: [1, 2, 3, 4, 5],
  timing: 'anytime',
  ...over
});

const done = (routineId: string, value = true): RoutineCompletion =>
  ({ id: `x-${routineId}`, date: '2026-09-14', routineId, done: value });

describe('getRoutineDayStates', () => {
  it('marks a scheduled routine unsatisfied until it is done', () => {
    const [state] = getRoutineDayStates([routine()], [], monday);
    expect(state.scheduled).toBe(true);
    expect(state.done).toBe(false);
    expect(state.satisfied).toBe(false);
  });

  it('marks a scheduled routine satisfied once done', () => {
    const [state] = getRoutineDayStates([routine()], [done('r1')], monday);
    expect(state.satisfied).toBe(true);
  });

  it('auto-satisfies a routine not scheduled that day', () => {
    const [state] = getRoutineDayStates([routine()], [], saturday);
    expect(state.scheduled).toBe(false);
    expect(state.done).toBe(false);
    expect(state.satisfied).toBe(true);
  });

  it('treats a completion recorded as not done as undone', () => {
    const [state] = getRoutineDayStates([routine()], [done('r1', false)], monday);
    expect(state.satisfied).toBe(false);
  });

  it('drops inactive routines entirely', () => {
    expect(getRoutineDayStates([routine({ active: false })], [], monday)).toHaveLength(0);
  });

  it('ignores completions belonging to other routines', () => {
    const [state] = getRoutineDayStates([routine()], [done('somebody-else')], monday);
    expect(state.satisfied).toBe(false);
  });
});

describe('hasDayMedal', () => {
  it('needs every routine satisfied', () => {
    const routines = [routine(), routine({ routineId: 'r2', name: 'Gym' })];
    expect(hasDayMedal(getRoutineDayStates(routines, [done('r1')], monday))).toBe(false);
    expect(hasDayMedal(getRoutineDayStates(routines, [done('r1'), done('r2')], monday))).toBe(true);
  });

  it('is earned on a day where nothing was scheduled', () => {
    expect(hasDayMedal(getRoutineDayStates([routine()], [], saturday))).toBe(true);
  });

  it('is not earned when there are no routines at all', () => {
    expect(hasDayMedal([])).toBe(false);
  });
});
