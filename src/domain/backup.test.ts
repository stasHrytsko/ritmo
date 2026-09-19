import { describe, expect, it } from 'vitest';
import { BackupValidationError, describeBackup, parseBackup } from './backup';
import { SCHEMA_VERSION } from './types';

const valid = () => ({
  schemaVersion: 2,
  exportedAt: '2026-09-18T00:00:00.000Z',
  routines: [{ id: 'r1', name: 'Walk', timing: 'exact', time: '07:30' }],
  goals: [{ id: 'g1', name: 'Ship' }],
  goalTasks: [{ id: 't1', goalId: 'g1' }],
  weeks: [{
    id: '2026-09-14',
    startDate: '2026-09-14',
    endDate: '2026-09-20',
    routinePlanSnapshot: [
      { routineId: 'r1', name: 'Walk', active: true, weekdays: [1], timing: 'anytime' }
    ]
  }],
  completions: [{ id: 'c1', date: '2026-09-15', routineId: 'r1', done: true }],
  settings: [{ key: 'app', schemaVersion: 2 }]
});

describe('parseBackup', () => {
  it('upgrades a v2 file to the current schema', () => {
    const result = parseBackup(valid());
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.settings[0].schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('turns a legacy week snapshot into a single plan revision', () => {
    const [week] = parseBackup(valid()).weeks;
    expect(week.routinePlan).toHaveLength(1);
    expect(week.routinePlan[0].appliesFrom).toBe('2026-09-14');
    expect(week.routinePlan[0].routines).toHaveLength(1);
    expect(week).not.toHaveProperty('routinePlanSnapshot');
  });

  it('keeps an already-migrated plan', () => {
    const payload = {
      ...valid(),
      schemaVersion: 3,
      weeks: [{
        id: '2026-09-14',
        startDate: '2026-09-14',
        endDate: '2026-09-20',
        routinePlan: [
          { appliesFrom: '2026-09-17', routines: [] },
          { appliesFrom: '2026-09-14', routines: [] }
        ]
      }]
    };
    expect(parseBackup(payload).weeks[0].routinePlan.map((r) => r.appliesFrom))
      .toEqual(['2026-09-14', '2026-09-17']);
  });

  it('accepts a file from before notes existed', () => {
    const payload = valid();
    expect('notes' in payload).toBe(false);
    expect(parseBackup(payload).notes).toEqual([]);
  });

  it('turns a flat v4 note into a titled one and drops its old fields', () => {
    const payload = {
      ...valid(),
      schemaVersion: 4,
      notes: [{ id: 'n1', text: 'Buy a desk', status: 'done', completedAt: '2026-09-18' }]
    };
    const [note] = parseBackup(payload).notes;

    expect(note.title).toBe('Buy a desk');
    expect(note).not.toHaveProperty('text');
    expect(note).not.toHaveProperty('status');
    expect(note).not.toHaveProperty('completedAt');
  });

  it('restores notes with their entries', () => {
    const payload = {
      ...valid(),
      schemaVersion: 5,
      notes: [{ id: 'n1', title: 'Home' }],
      noteEntries: [
        { id: 'e1', noteId: 'n1', text: 'Fix the tap' },
        { id: 'e2', noteId: 'n1', text: 'Buy a desk' }
      ]
    };
    const restored = parseBackup(payload);

    expect(restored.notes[0].title).toBe('Home');
    expect(restored.noteEntries.map((entry) => entry.text)).toEqual(['Fix the tap', 'Buy a desk']);
  });

  it('accepts a file from before note entries existed', () => {
    const payload = { ...valid(), schemaVersion: 4, notes: [{ id: 'n1', text: 'Home' }] };
    expect(parseBackup(payload).noteEntries).toEqual([]);
  });

  it.each([
    ['a note with no wording at all', { ...valid(), notes: [{ id: 'n1' }] }],
    ['a note without an id', { ...valid(), notes: [{ title: 'Home' }] }],
    ['a notes list that is not a list', { ...valid(), notes: 'nope' }],
    ['an entry without text', { ...valid(), noteEntries: [{ id: 'e1', noteId: 'n1' }] }],
    ['an entry with no note', { ...valid(), noteEntries: [{ id: 'e1', text: 'Fix the tap' }] }],
    ['an entries list that is not a list', { ...valid(), noteEntries: 'nope' }]
  ])('rejects %s', (_label, payload) => {
    expect(() => parseBackup(payload)).toThrow(BackupValidationError);
  });

  it('drops a stray time from an anytime routine', () => {
    const payload = { ...valid(), routines: [{ id: 'r1', name: 'Walk', timing: 'anytime', time: '07:30' }] };
    expect(parseBackup(payload).routines[0].time).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['an array', []],
    ['an unknown version', { ...valid(), schemaVersion: 99 }],
    ['a missing version', { ...valid(), schemaVersion: undefined }],
    ['a missing list', { ...valid(), completions: undefined }],
    ['a non-array list', { ...valid(), goals: 'nope' }],
    ['a null entry', { ...valid(), goals: [null] }],
    ['a routine without an id', { ...valid(), routines: [{ name: 'Walk' }] }],
    ['a task without a goalId', { ...valid(), goalTasks: [{ id: 't1' }] }],
    ['a completion without a routineId', { ...valid(), completions: [{ id: 'c1', date: '2026-09-15' }] }],
    ['a setting without a key', { ...valid(), settings: [{ schemaVersion: 2 }] }]
  ])('rejects %s', (_label, payload) => {
    expect(() => parseBackup(payload)).toThrow(BackupValidationError);
  });

  it('explains which list is wrong', () => {
    expect(() => parseBackup({ ...valid(), weeks: undefined }))
      .toThrow(/"weeks"/);
  });
});

describe('describeBackup', () => {
  it('summarises what a restore would replace', () => {
    expect(describeBackup(parseBackup(valid())))
      .toBe('1 routines, 1 goals, 0 notes, 1 completion records');
  });
});
