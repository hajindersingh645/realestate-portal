import { expect, test } from 'vitest';
import { LOCATION_TYPES, LOOKUP_GROUPS, PROPERTY_KINDS } from './catalog.js';

test.each([
  ['LOOKUP_GROUPS', LOOKUP_GROUPS],
  ['PROPERTY_KINDS', PROPERTY_KINDS],
  ['LOCATION_TYPES', LOCATION_TYPES],
])('%s, as a list, has no duplicates and only snake_case values', (_name, values) => {
  expect(new Set(values).size).toBe(values.length);
  for (const value of values) expect(value).toMatch(/^[a-z_]+$/);
});
