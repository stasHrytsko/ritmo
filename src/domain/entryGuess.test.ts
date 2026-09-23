import { describe, expect, it } from 'vitest';
import { guessRoutine } from './entryGuess';

describe('guessRoutine', () => {
  it('finds a single weekday', () => {
    expect(guessRoutine('Бассейн по субботам')).toEqual({ part: 3, weekdays: [6] });
  });

  it('finds the part of the day', () => {
    expect(guessRoutine('Витамин D утром').part).toBe(0);
    expect(guessRoutine('Прогулка после обеда').part).toBe(1);
    expect(guessRoutine('Читать вечером').part).toBe(2);
  });

  it('reads weekdays and weekends as groups', () => {
    expect(guessRoutine('Зарядка по будням').weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(guessRoutine('Долгая пробежка на выходных').weekdays).toEqual([6, 7]);
  });

  it('collects several named days in week order', () => {
    expect(guessRoutine('Зал в пятницу и понедельник').weekdays).toEqual([1, 5]);
  });

  it('falls back to every day, any time', () => {
    expect(guessRoutine('Пить воду')).toEqual({ part: 3, weekdays: [1, 2, 3, 4, 5, 6, 7] });
  });
});
