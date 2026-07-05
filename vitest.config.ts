import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Pin the timezone so date-formatting logic (some of which mixes local parsing
// with UTC output) is deterministic regardless of the machine's local zone.
process.env.TZ = 'UTC';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'cli/**/*.test.ts'],
    env: { TZ: 'UTC' },
  },
});
