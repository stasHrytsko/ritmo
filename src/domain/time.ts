import type { ISODate } from './types';

const MS_PER_DAY = 86_400_000;

const pad = (value: number) => String(value).padStart(2, '0');

export const toISODate = (date: Date): ISODate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromISODate = (date: ISODate): Date => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

/**
 * Whole calendar days between two dates. Rounding off local midnights keeps
 * this correct across daylight-saving changes, where a day is 23 or 25 hours.
 */
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

export const isoWeekday = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

export const weekStart = (date: Date) =>
  addDays(startOfDay(date), 1 - isoWeekday(date));

export const weekEnd = (date: Date) => addDays(weekStart(date), 6);

export const weekId = (date: Date): ISODate => toISODate(weekStart(date));

export const weekNumber = (date: Date) => {
  const thursday = addDays(startOfDay(date), 4 - isoWeekday(date));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor(daysBetween(yearStart, thursday) / 7) + 1;
};

export const dayOfYear = (date: Date) =>
  daysBetween(new Date(date.getFullYear(), 0, 1), date) + 1;

export const daysInYear = (year: number) =>
  daysBetween(new Date(year, 0, 1), new Date(year + 1, 0, 1));

export const daysLeftInYear = (date: Date) =>
  Math.max(0, daysBetween(date, new Date(date.getFullYear() + 1, 0, 1)) - 1);

export const weeksLeftInYear = (date: Date) =>
  Math.ceil(daysLeftInYear(date) / 7);

export const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

/**
 * The day the user is still living. Before the boundary hour the previous day
 * is still "today", so a routine ticked off at 01:00 lands where it belongs
 * instead of on a day that has barely started.
 */
export const logicalDay = (now: Date, boundaryHour: number): Date => {
  const shifted = new Date(now.getTime());
  shifted.setHours(shifted.getHours() - boundaryHour);
  return startOfDay(shifted);
};

export const logicalDayKey = (now: Date, boundaryHour: number): ISODate =>
  toISODate(logicalDay(now, boundaryHour));

const LOCALE = 'ru';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Standalone month name, capitalised: «Сентябрь». */
export const monthName = (date: Date, style: 'long' | 'short' = 'long') =>
  capitalize(new Intl.DateTimeFormat(LOCALE, { month: style }).format(date).replace('.', ''));

/** «23 сентября» — day with the month in the genitive case. */
export const dayMonth = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' }).format(date);

/** Genitive month on its own: «сентября». */
export const monthGenitive = (date: Date) => dayMonth(date).replace(/^\d+\s*/, '');

export const weekdayName = (date: Date, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat(LOCALE, { weekday: style }).format(date);

/** Monday-first single letters for grids and strips. */
export const WEEKDAY_LETTERS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

export const formatRange = (start: Date, end: Date) => {
  const format = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
  return `${format.format(start).replace('.', '')} — ${format.format(end).replace('.', '')}`;
};

/** Russian plural: plural(5, ['день', 'дня', 'дней']) → 'дней'. */
export const plural = (count: number, forms: [string, string, string]) => {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
};
