import {
  CheckConstraintViolationException,
  ForeignKeyConstraintViolationException,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import { ConflictError, ValidationError } from './errors.js';

export interface DbErrorMessages {
  unique?: string;
  reference?: string;
  check?: string;
}

/**
 * Runs a database write and turns constraint violations into client errors.
 * The database is the judge of uniqueness and references; this only translates its verdict.
 */
export async function withDbErrors<T>(
  fn: () => Promise<T>,
  messages: DbErrorMessages = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (error instanceof UniqueConstraintViolationException) {
      throw new ConflictError(messages.unique ?? 'Already exists');
    }
    if (error instanceof ForeignKeyConstraintViolationException) {
      throw new ValidationError(messages.reference ?? 'A referenced record does not exist');
    }
    if (error instanceof CheckConstraintViolationException) {
      throw new ValidationError(messages.check ?? 'A value is not allowed');
    }
    throw error;
  }
}
