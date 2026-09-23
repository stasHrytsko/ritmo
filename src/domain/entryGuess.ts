const DAY_WORDS: Array<[RegExp, number]> = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред[уаы]/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресень/, 7]
];

/**
 * Reads the obvious out of a note entry: «бассейн по субботам» is a Saturday
 * routine, «витамин утром» a morning one. `part` is 0 morning, 1 day,
 * 2 evening, 3 any time.
 */
export function guessRoutine(text: string): { part: number; weekdays: number[] } {
  const lower = text.toLowerCase();
  const part = /утр/.test(lower) ? 0
    : /днём|днем|обед/.test(lower) ? 1
    : /вечер|перед сном/.test(lower) ? 2
    : 3;

  let weekdays = DAY_WORDS.filter(([pattern]) => pattern.test(lower)).map(([, day]) => day);
  if (/будн/.test(lower)) weekdays = [1, 2, 3, 4, 5];
  else if (/выходн/.test(lower)) weekdays = [6, 7];
  if (weekdays.length === 0) weekdays = [1, 2, 3, 4, 5, 6, 7];

  return { part, weekdays };
}
