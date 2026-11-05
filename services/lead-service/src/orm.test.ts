import { readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MIGRATIONS } from './orm.js';

test('MIGRATIONS, compared with the migrations folder, lists every file in order', () => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed folder next to this file
  const files = readdirSync(new URL('../migrations', import.meta.url))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.replace(/\.ts$/, ''))
    .sort();

  expect(MIGRATIONS.map((migration) => migration.name)).toEqual(files);
});
