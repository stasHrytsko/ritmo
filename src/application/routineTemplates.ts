import type { Routine } from '../domain/types';

export interface RoutineTemplate {
  id: string;
  name: string;
  hint: string;
  weekdays: number[];
  timing: Routine['timing'];
  time?: string;
}

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

/** Starting points offered on first run. Picked, they become ordinary routines. */
export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  { id: 'water-morning', name: 'Стакан воды после пробуждения', hint: 'каждый день · 07:30', weekdays: EVERY_DAY, timing: 'exact', time: '07:30' },
  { id: 'exercise', name: 'Зарядка 10 минут', hint: 'каждый день · 07:45', weekdays: EVERY_DAY, timing: 'exact', time: '07:45' },
  { id: 'walk', name: 'Прогулка 30 минут', hint: 'каждый день · в любое время', weekdays: EVERY_DAY, timing: 'anytime' },
  { id: 'training', name: 'Тренировка', hint: 'пн, ср, пт · в любое время', weekdays: [1, 3, 5], timing: 'anytime' },
  { id: 'reading', name: 'Чтение 20 минут', hint: 'каждый день · 21:30', weekdays: EVERY_DAY, timing: 'exact', time: '21:30' },
  { id: 'no-screens', name: 'Без экранов перед сном', hint: 'каждый день · 22:30', weekdays: EVERY_DAY, timing: 'exact', time: '22:30' }
];
