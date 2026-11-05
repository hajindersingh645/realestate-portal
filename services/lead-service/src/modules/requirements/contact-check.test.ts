import { expect, test } from 'vitest';
import { findContactDetails } from './contact-check.js';

test.each([
  ['call 98150 12345', 'phone'],
  ['+91-98150-12345', 'phone'],
  ['0981 501 2345', 'phone'],
  ['9815012345', 'phone'],
  ['<p>call <b>98150</b> 12345</p>', 'phone'],
  ['mail a@b.in please', 'email'],
  ['see www.x.in', 'link'],
  ['details on hanu.com', 'link'],
  ['https://example.org/flat', 'link'],
])('findContactDetails, for %j, returns %s', (text, expected) => {
  expect(findContactDetails(text)).toBe(expected);
});

test.each([
  '3 BHK near the market',
  'Sector 70, Mohali',
  '₹85 lakh, negotiable',
  'budget 8500000',
  'possession by 2026',
  'near phase 3b2',
  '1500-2000 sq ft, 2nd floor or higher',
  '',
])('findContactDetails, for ordinary text %j, returns null', (text) => {
  expect(findContactDetails(text)).toBeNull();
});
