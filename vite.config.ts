import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Pinned behind UTC on purpose. Under UTC a `new Date('YYYY-MM-DD')`
    // implementation of addDays is indistinguishable from the correct
    // component-based one, so the date tests would silently stop guarding
    // the bug they exist for. See src/utils/date.test.ts.
    env: { TZ: 'America/Los_Angeles' },
  },
});
