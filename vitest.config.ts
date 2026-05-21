import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['skills/**', 'gfcli/**', 'dist/**', 'node_modules/**'],
  },
});
