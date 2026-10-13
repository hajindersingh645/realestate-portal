import { defineConfig } from 'vitest/config';
import { swcDecorators } from './vitest.swc.js';

export default defineConfig({
  plugins: [swcDecorators],
  test: {
    include: ['**/*.int.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
