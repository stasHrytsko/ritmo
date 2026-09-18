import { defineConfig } from 'vitest/config';

// A timezone with daylight saving, so date maths is exercised where it breaks.
process.env.TZ = 'Europe/Warsaw';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
