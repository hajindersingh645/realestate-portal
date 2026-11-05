import { sql, type Em } from './db.js';

/**
 * The current value of a settings row (highest version wins). `value` is jsonb, so it comes
 * back parsed. Throws for a missing key: settings are seeded by migrations, never optional.
 */
export async function getSetting<T = unknown>(em: Em, key: string): Promise<T> {
  const rows = await sql<{ value: T }>(
    em,
    'select value from settings where key = ? order by version desc limit 1',
    [key],
  );
  const row = rows[0];
  if (row === undefined) throw new Error(`Missing setting: ${key}`);
  return row.value;
}
