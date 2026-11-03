import { randomUUID } from 'node:crypto';
import { Entity, Filter, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * One row of a small admin-editable list (BHK options, amenities, area units…).
 * Retired with `isActive`; soft-deleted with `deletedAt` only when created by mistake.
 * The unique rule includes deleted rows, so a code is never reused.
 */
@Entity({ tableName: 'lookups' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
@Unique({ properties: ['group', 'code'] })
export class Lookup {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  group!: string;

  /** Never changes after creation: other tables and code refer to it. */
  @Property({ type: 'text' })
  code!: string;

  @Property({ type: 'text' })
  label!: string;

  @Property({ type: 'json', nullable: true })
  meta?: Record<string, unknown>;

  @Property({ type: 'boolean' })
  isActive = true;

  @Property({ type: 'integer' })
  sort = 0;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
