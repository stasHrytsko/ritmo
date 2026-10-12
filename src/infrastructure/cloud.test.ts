import { describe, expect, it } from 'vitest';
import { describeAuthError } from './cloud';

describe('describeAuthError', () => {
  it('says a wrong or stale code in Russian', () => {
    expect(describeAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid' }))
      .toMatch(/Код неверный/);
  });

  it('says rate limits in Russian', () => {
    expect(describeAuthError({ status: 429, message: 'email rate limit exceeded' })).toMatch(/Подождите/);
  });

  it('says a lost connection in Russian', () => {
    expect(describeAuthError(new TypeError('Failed to fetch'))).toMatch(/Нет соединения/);
  });

  it('never shows a raw server string', () => {
    expect(describeAuthError(new Error('Something odd happened'))).toBe('Не получилось. Попробуйте ещё раз чуть позже.');
  });
});
