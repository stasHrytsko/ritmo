import type { ISODate } from './types';

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

export const isoWeekday = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

export const weekStart = (date: Date) =>
  addDays(startOfDay(date), 1 - isoWeekday(date));

export const weekEnd = (date: Date) => addDays(weekStart(date), 6);

export const weekId = (date: Date): ISODate => toISODate(weekStart(date));

export const weekNumber = (date: Date) => {
  const target = startOfDay(date);
  const thursday = addDays(target, 4 - isoWeekday(target));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  return Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const daysLeftInYear = (date: Date) => {
  const today = startOfDay(date);
  const nextYear = new Date(today.getFullYear() + 1, 0, 1);
  return Math.max(0, Math.round((nextYear.getTime() - today.getTime()) / 86400000) - 1);
};

export const weeksLeftInYear = (date: Date) =>
  Math.ceil(daysLeftInYear(date) / 7);

export const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

export const monthName = (date: Date, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat('en', { month: style }).format(date);

export const weekdayName = (date: Date, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat('en', { weekday: style }).format(date);

export const formatRange = (start: Date, end: Date) => {
  const startText = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(start);
  const endText = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(end);
  return `${startText} — ${endText}`;
};
