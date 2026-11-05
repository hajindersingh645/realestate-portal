import { ValidationError } from './errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keyset cursor for lists ordered by `(created_at desc, id desc)`: base64url of `createdAt|id`. */
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): [string, string] {
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (
    createdAt === undefined ||
    id === undefined ||
    Number.isNaN(Date.parse(createdAt)) ||
    !UUID.test(id)
  ) {
    throw new ValidationError('Invalid cursor');
  }
  return [createdAt, id];
}
