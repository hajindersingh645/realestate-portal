import { randomUUID } from 'node:crypto';
import { Entity, Filter, Index, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/**
 * A state, a city or a locality (sector). One table with a self-reference.
 * The hierarchy rules live in the migration as database constraints, not here.
 * Retired with `isActive`; soft-deleted with `deletedAt`. A deleted slug stays taken.
 */
@Entity({ tableName: 'locations' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class Location {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** state | city | locality */
  @Property({ type: 'text' })
  type!: string;

  @Index()
  @Property({ type: 'uuid', nullable: true })
  parentId?: string;

  /** Copy of the parent's type. With parent_id it forms the foreign key that enforces the hierarchy. */
  @Property({ type: 'text', nullable: true })
  parentType?: string;

  @Property({ type: 'text' })
  name!: string;

  /** Never changes after creation in this phase: page URLs are built from it. */
  @Property({ type: 'text' })
  slug!: string;

  /** Short state code (PB, HR, CH). States only. */
  @Property({ type: 'text', nullable: true })
  code?: string;

  @Property({ type: 'double', nullable: true })
  lat?: number;

  @Property({ type: 'double', nullable: true })
  lng?: number;

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
