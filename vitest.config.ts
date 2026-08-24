import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// NOTE: the timezone is deliberately NOT pinned here. Date handling in this repo
// works on local calendar parts, so the suite must pass in any zone. `npm test`
// runs it a second time under TZ=Asia/Shanghai (east of UTC) to keep it that way
// — pinning TZ=UTC previously hid a bug where daily recurrences never advanced.

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'cli/**/*.test.ts'],
  },
});
