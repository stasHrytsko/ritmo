import { describe, expect, it } from 'vitest';
import { planForDate, routinesInWeek, withPlanRevision } from './plan';
import type { RoutineSnapshot, WeekRecord } from './types';

const snap = (routineId: string, name: string): RoutineSnapshot => ({
  routineId,
  name,
  active: true,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  timing: 'anytime'
});

const week = (): WeekRecord => ({
  id: '2026-09-14',
  startDate: '2026-09-14',
  endDate: '2026-09-20',
  year: 2026,
  weekNumber: 38,
  routinePlan: [{ appliesFrom: '2026-09-14', routines: [snap('a', 'Walk')] }],
  createdAt: '2026-09-14T00:00:00.000Z'
});

describe('withPlanRevision', () => {
  it('leaves earlier days on the plan they were judged against', () => {
    const edited = withPlanRevision(week(), '2026-09-18', [snap('a', 'Walk'), snap('b', 'Gym')]);

    expect(planForDate(edited, '2026-09-15').map((r) => r.routineId)).toEqual(['a']);
    expect(planForDate(edited, '2026-09-18').map((r) => r.routineId)).toEqual(['a', 'b']);
    expect(planForDate(edited, '2026-09-20').map((r) => r.routineId)).toEqual(['a', 'b']);
  });

  it('replaces a revision applied the same day instead of stacking', () => {
    const once = withPlanRevision(week(), '2026-09-18', [snap('a', 'Walk'), snap('b', 'Gym')]);
    const twice = withPlanRevision(once, '2026-09-18', [snap('a', 'Walk')]);

    expect(twice.routinePlan).toHaveLength(2);
    expect(planForDate(twice, '2026-09-18').map((r) => r.routineId)).toEqual(['a']);
    expect(planForDate(twice, '2026-09-15').map((r) => r.routineId)).toEqual(['a']);
  });

  it('clamps a revision that would start before the week', () => {
    const edited = withPlanRevision(week(), '2026-09-01', [snap('b', 'Gym')]);
    expect(edited.routinePlan).toHaveLength(1);
    expect(edited.routinePlan[0].appliesFrom).toBe('2026-09-14');
  });

  it('keeps revisions in order', () => {
    const edited = withPlanRevision(
      withPlanRevision(week(), '2026-09-19', [snap('c', 'Read')]),
      '2026-09-16',
      [snap('b', 'Gym')]
    );
    // A revision replaces everything after it, so 09-19 is dropped by 09-16.
    expect(edited.routinePlan.map((r) => r.appliesFrom)).toEqual(['2026-09-14', '2026-09-16']);
  });
});

describe('planForDate', () => {
  it('returns nothing for a day before any revision', () => {
    expect(planForDate(week(), '2026-09-13')).toEqual([]);
  });
});

describe('routinesInWeek', () => {
  it('unions every revision, latest version winning', () => {
    const renamed = { ...snap('a', 'Walk the dog') };
    const edited = withPlanRevision(week(), '2026-09-18', [renamed, snap('b', 'Gym')]);

    const all = routinesInWeek(edited);
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.routineId === 'a')?.name).toBe('Walk the dog');
  });

  it('keeps a routine that was removed midweek', () => {
    const edited = withPlanRevision(week(), '2026-09-18', []);
    expect(routinesInWeek(edited).map((r) => r.routineId)).toEqual(['a']);
  });
});
