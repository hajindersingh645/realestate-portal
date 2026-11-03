/**
 * Normalises an Indian mobile number to E.164 (`+919815012345`), or returns null.
 * Accepts spaces, dashes, brackets, a leading 0, 91 or +91. Mobiles start with 6–9.
 */
export function normalisePhone(input: string, country: string): string | null {
  if (country !== 'IN') throw new Error(`Phone numbers for ${country} are not supported yet`);
  const digits = input.replace(/[\s\-()]/g, '');
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return match?.[1] === undefined ? null : `+91${match[1]}`;
}
