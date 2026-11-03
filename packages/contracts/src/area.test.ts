import { expect, test } from 'vitest';
import { convertToBaseArea, type AreaConversion } from './area.js';

const MARLA = 'unit-marla';
const SQYD = 'unit-sqyd';
const ZIRAKPUR = 'city-zirakpur';
const conversions: AreaConversion[] = [
  { unitId: MARLA, locationId: null, factor: 225 },
  { unitId: MARLA, locationId: ZIRAKPUR, factor: 272.25 },
  { unitId: SQYD, locationId: null, factor: 9 },
];

test('convertToBaseArea, when the city has its own factor, uses it', () => {
  expect(convertToBaseArea(conversions, MARLA, ZIRAKPUR, 10)).toBe(2722.5);
});

test('convertToBaseArea, when the city has no factor, falls back to the default', () => {
  expect(convertToBaseArea(conversions, MARLA, 'city-mohali', 10)).toBe(2250);
});

test('convertToBaseArea, when no city is given, uses the default', () => {
  expect(convertToBaseArea(conversions, SQYD, null, 100)).toBe(900);
});

test('convertToBaseArea, when the unit has no conversion at all, returns null', () => {
  expect(convertToBaseArea(conversions, 'unit-bigha', ZIRAKPUR, 1)).toBeNull();
});

test('convertToBaseArea, when a unit has only a city factor and another city asks, returns null', () => {
  const cityOnly: AreaConversion[] = [{ unitId: MARLA, locationId: ZIRAKPUR, factor: 272.25 }];

  expect(convertToBaseArea(cityOnly, MARLA, 'city-mohali', 1)).toBeNull();
});
