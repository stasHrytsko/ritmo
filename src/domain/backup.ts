import {
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  type BackupPayload,
  type RoutineSnapshot,
  type WeekRecord
} from './types';

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const firstText = (...values: unknown[]) =>
  values.find((value) => typeof value === 'string' && value.trim() !== '');

const requireArray = (payload: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  const value = payload[key];
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`Backup is missing the "${key}" list.`);
  }
  if (!value.every(isRecord)) {
    throw new BackupValidationError(`Backup has a malformed entry in "${key}".`);
  }
  return value;
};

/** Lists added after a backup format shipped are absent from older files. */
const optionalArray = (payload: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  if (payload[key] === undefined) return [];
  const value = payload[key];
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`Backup has a malformed "${key}" list.`);
  }
  if (!value.every(isRecord)) {
    throw new BackupValidationError(`Backup has a malformed entry in "${key}".`);
  }
  return value;
};

const requireFields = (rows: Record<string, unknown>[], key: string, fields: string[]) => {
  for (const row of rows) {
    for (const field of fields) {
      if (typeof row[field] !== 'string' || row[field] === '') {
        throw new BackupValidationError(`Backup has an entry in "${key}" without "${field}".`);
      }
    }
  }
  return rows;
};

const normalizeRoutineLike = (routine: Record<string, unknown>) => ({
  ...routine,
  timing: routine.timing === 'exact' ? 'exact' : 'anytime',
  time: routine.timing === 'exact' ? routine.time : undefined
});

const normalizeWeek = (week: Record<string, unknown>): WeekRecord => {
  const startDate = String(week.startDate);
  const legacy = Array.isArray(week.routinePlanSnapshot)
    ? (week.routinePlanSnapshot as Record<string, unknown>[])
    : [];

  const revisions = Array.isArray(week.routinePlan)
    ? (week.routinePlan as Record<string, unknown>[]).map((revision) => ({
        appliesFrom: typeof revision.appliesFrom === 'string' ? revision.appliesFrom : startDate,
        routines: (Array.isArray(revision.routines) ? revision.routines : [])
          .filter(isRecord)
          .map(normalizeRoutineLike) as unknown as RoutineSnapshot[]
      }))
    : [{
        appliesFrom: startDate,
        routines: legacy.map(normalizeRoutineLike) as unknown as RoutineSnapshot[]
      }];

  const rest = { ...week };
  delete rest.routinePlanSnapshot;
  return {
    ...(rest as unknown as WeekRecord),
    routinePlan: revisions.sort((a, b) => a.appliesFrom.localeCompare(b.appliesFrom))
  };
};

/**
 * Validates and upgrades an untrusted backup file. Throws before the caller
 * touches the database, so a broken file can never land between a wipe and a
 * restore.
 */
export const parseBackup = (raw: unknown): BackupPayload => {
  if (!isRecord(raw)) {
    throw new BackupValidationError('Backup file is not a Ritmo backup.');
  }

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
    throw new BackupValidationError(`Unsupported backup version: ${String(version)}.`);
  }

  const routines = requireFields(requireArray(raw, 'routines'), 'routines', ['id', 'name']);
  const goals = requireFields(requireArray(raw, 'goals'), 'goals', ['id', 'name']);
  const goalTasks = requireFields(requireArray(raw, 'goalTasks'), 'goalTasks', ['id', 'goalId']);
  const weeks = requireFields(requireArray(raw, 'weeks'), 'weeks', ['id', 'startDate', 'endDate']);
  const completions = requireFields(requireArray(raw, 'completions'), 'completions', [
    'id',
    'date',
    'routineId'
  ]);
  // Notes arrived in v4 as flat text and became titled lists in v5, so a
  // note's own wording may be under either key. Older files have none at all.
  const notes = optionalArray(raw, 'notes').map((note) => ({
    ...note,
    title: firstText(note.title, note.text)
  }));
  requireFields(notes, 'notes', ['id', 'title']);
  const noteEntries = requireFields(optionalArray(raw, 'noteEntries'), 'noteEntries', [
    'id',
    'noteId',
    'text'
  ]);

  // Drop the fields a v4 note carried; a note is just a title now.
  const titledNotes = notes.map((note): Record<string, unknown> => {
    const rest: Record<string, unknown> = { ...note };
    delete rest.text;
    delete rest.status;
    delete rest.completedAt;
    return rest;
  });
  const settings = requireFields(requireArray(raw, 'settings'), 'settings', ['key']);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    routines: routines.map(normalizeRoutineLike) as unknown as BackupPayload['routines'],
    goals: goals as unknown as BackupPayload['goals'],
    goalTasks: goalTasks as unknown as BackupPayload['goalTasks'],
    weeks: weeks.map(normalizeWeek),
    completions: completions as unknown as BackupPayload['completions'],
    notes: titledNotes as unknown as BackupPayload['notes'],
    noteEntries: noteEntries.map(normalizeNoteEntry) as unknown as BackupPayload['noteEntries'],
    settings: settings.map((item) => ({
      ...item,
      schemaVersion: SCHEMA_VERSION
    })) as unknown as BackupPayload['settings']
  };
};

/** Rough size of a backup, for the confirmation prompt. */
export const describeBackup = (payload: BackupPayload) =>
  `рутин: ${payload.routines.length}, целей: ${payload.goals.length}, `
  + `заметок: ${payload.notes.length}, отметок: ${payload.completions.length}`;

const ENTRY_OUTCOMES: readonly unknown[] = ['goal', 'task', 'routine'];

/** An entry's outcome mark is optional; one this version does not know is dropped. */
function normalizeNoteEntry(entry: Record<string, unknown>): Record<string, unknown> {
  if (entry.madeInto === undefined || ENTRY_OUTCOMES.includes(entry.madeInto)) return entry;
  const rest = { ...entry };
  delete rest.madeInto;
  return rest;
}
