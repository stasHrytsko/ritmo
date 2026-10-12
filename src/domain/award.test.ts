import { describe, expect, it } from 'vitest';
import { tierOf } from './award';

describe('tierOf', () => {
  it('maps shares to medals at the documented thresholds', () => {
    expect(tierOf(1)).toBe('gold');
    expect(tierOf(0.99)).toBe('silver');
    expect(tierOf(0.7)).toBe('silver');
    expect(tierOf(0.69)).toBe('bronze');
    expect(tierOf(0.5)).toBe('bronze');
    expect(tierOf(0.49)).toBeNull();
    expect(tierOf(0)).toBeNull();
  });

  it('skips periods with nothing owed', () => {
    expect(tierOf(null)).toBeNull();
    expect(tierOf(undefined)).toBeNull();
  });

  it('treats a float sum that is one up to rounding as gold', () => {
    expect(tierOf(0.1 + 0.2 + 0.7)).toBe('gold');
  });
});
