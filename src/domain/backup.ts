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

const requireArray = (payload: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  const value = payload[key];
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`Backup is missing the "${key}" list.`);
  }
  if (!value.every(isRecord)) {
    throw new BackupValidationError(`Backup has a malformed entry in "${key}".`);
  }
  return value as Record<string, unknown>[];
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
  const startDate = week.startDate as string;
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

  const { routinePlanSnapshot: _legacy, ...rest } = week;
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
  const settings = requireFields(requireArray(raw, 'settings'), 'settings', ['key']);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    routines: routines.map(normalizeRoutineLike) as unknown as BackupPayload['routines'],
    goals: goals as unknown as BackupPayload['goals'],
    goalTasks: goalTasks as unknown as BackupPayload['goalTasks'],
    weeks: weeks.map(normalizeWeek),
    completions: completions as unknown as BackupPayload['completions'],
    settings: settings.map((item) => ({
      ...item,
      schemaVersion: SCHEMA_VERSION
    })) as unknown as BackupPayload['settings']
  };
};

/** Rough size of a backup, for the confirmation prompt. */
export const describeBackup = (payload: BackupPayload) =>
  `${payload.routines.length} routines, ${payload.goals.length} goals, `
  + `${payload.completions.length} completion records`;
