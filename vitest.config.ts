import { defineConfig } from 'vitest/config';
import { swcDecorators } from './vitest.swc.js';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [swcDecorators],
        test: {
          name: 'services',
          include: ['packages/**/*.test.ts', 'services/**/*.test.ts'],
          // web-kit runs in its own jsdom project below.
          exclude: ['**/*.int.test.ts', '**/node_modules/**', '**/dist/**', 'packages/web-kit/**'],
        },
      },
      'apps/admin/vitest.config.ts',
      'packages/web-kit/vitest.config.ts',
    ],
  },
});
