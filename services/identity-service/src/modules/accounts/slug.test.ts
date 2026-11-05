import { expect, test } from 'vitest';
import { slugify } from './slug.js';

test.each([
  ['Ravi Kumar & Sons', 'ravi-kumar-sons'],
  ['  Tricity   Homes  ', 'tricity-homes'],
  ['Café Réalty', 'cafe-realty'],
  ['!!!', 'pro'],
  ['राज प्रॉपर्टी', 'pro'],
  ['Sector 70 Realtors', 'sector-70-realtors'],
])('slugify, for %j, gives %j', (name, slug) => {
  expect(slugify(name)).toBe(slug);
});

test('slugify, for a very long name, keeps at most 60 characters and no trailing hyphen', () => {
  const slug = slugify(`${'a'.repeat(59)} b`);

  expect(slug.length).toBeLessThanOrEqual(60);
  expect(slug.endsWith('-')).toBe(false);
});
