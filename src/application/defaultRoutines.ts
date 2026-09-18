import type { Routine } from '../domain/types';

export interface DefaultRoutine {
  name: string;
  weekdays: number[];
  timing: Routine['timing'];
  time?: string;
  /** Matches an existing routine that was named differently before. */
  match?: (routine: Routine) => boolean;
}

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
const WORK_DAYS = [1, 2, 3, 4, 5];

export const normalizeRoutineName = (value: string) =>
  value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');

/**
 * Seeded once into an empty install. This is personal preset data rather than
 * app logic — edit the list, not the service.
 */
export const DEFAULT_ROUTINES: DefaultRoutine[] = [
  { name: 'Подъём + стакан воды', weekdays: EVERY_DAY, timing: 'exact', time: '07:30' },
  { name: 'Зарядка 10–15 мин', weekdays: EVERY_DAY, timing: 'exact', time: '07:40' },
  { name: 'Душ', weekdays: EVERY_DAY, timing: 'exact', time: '08:00' },
  { name: 'Завтрак', weekdays: EVERY_DAY, timing: 'exact', time: '08:15' },
  {
    name: 'Выгулить Локи',
    weekdays: EVERY_DAY,
    timing: 'exact',
    time: '08:30',
    match: (routine) => normalizeRoutineName(routine.name).includes('локи')
  },
  { name: 'На работу', weekdays: WORK_DAYS, timing: 'exact', time: '08:40' },
  { name: 'Обед', weekdays: EVERY_DAY, timing: 'exact', time: '13:00' },
  { name: 'Ходьба 15 мин · после обеда', weekdays: EVERY_DAY, timing: 'exact', time: '13:15' },
  { name: 'Перекус при голоде', weekdays: EVERY_DAY, timing: 'exact', time: '17:00' },
  { name: 'Ходьба 15 мин · вечером', weekdays: EVERY_DAY, timing: 'exact', time: '17:10' },
  { name: 'Домой', weekdays: WORK_DAYS, timing: 'exact', time: '18:00' },
  { name: 'Физическая активность 40 мин', weekdays: EVERY_DAY, timing: 'exact', time: '19:00' },
  { name: 'Ужин', weekdays: EVERY_DAY, timing: 'exact', time: '20:00' },
  { name: 'Ходьба 15 мин · после ужина', weekdays: EVERY_DAY, timing: 'exact', time: '20:30' },
  { name: 'Больше не есть', weekdays: EVERY_DAY, timing: 'exact', time: '22:00' },
  { name: 'Сон', weekdays: EVERY_DAY, timing: 'exact', time: '23:00' },
  { name: 'Разминаться на работе каждые ~2 часа', weekdays: WORK_DAYS, timing: 'anytime' }
];
