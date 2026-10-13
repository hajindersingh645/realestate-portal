import { defineConfig } from 'vitest/config';
import { swcDecorators } from './vitest.swc.js';

export default defineConfig({
  plugins: [swcDecorators],
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/*.int.test.ts', '**/node_modules/**', '**/dist/**'],
  },
});
