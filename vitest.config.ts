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
          exclude: ['**/*.int.test.ts', '**/node_modules/**', '**/dist/**'],
        },
      },
      'apps/admin/vitest.config.ts',
    ],
  },
});
