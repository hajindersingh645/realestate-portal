import { randomUUID } from 'node:crypto';
import { Entity, Filter, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * Flat, house, plot, shop… A type may sit under a parent (Shop under Commercial).
 * Retired with `isActive`; soft-deleted with `deletedAt`. The slug stays taken after a delete.
 */
@Entity({ tableName: 'property_types' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
@Unique({ properties: ['slug'] })
export class PropertyType {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** Foreign key to this table, added by hand in the migration. */
  @Index()
  @Property({ type: 'uuid', nullable: true })
  parentId?: string;

  /** Never changes after creation. */
  @Property({ type: 'text' })
  slug!: string;

  @Property({ type: 'text' })
  name!: string;

  /** flat | house | plot | commercial. Checked by the database. */
  @Property({ type: 'text' })
  kind!: string;

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
