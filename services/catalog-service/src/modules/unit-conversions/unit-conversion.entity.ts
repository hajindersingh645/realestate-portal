import { randomUUID } from 'node:crypto';
import { Entity, Filter, Index, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/**
 * How many base area units one unit (marla, sq yd…) equals, by default or in one city.
 * Soft-deleted with `deletedAt`; unlike slugs, a deleted conversion can be added again.
 */
@Entity({ tableName: 'unit_conversions' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class UnitConversion {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** A lookup in the `area_unit` group. Foreign key added by hand in the migration. */
  @Index()
  @Property({ type: 'uuid' })
  unitId!: string;

  /** A city, or empty for the default. Foreign key added by hand in the migration. */
  @Index()
  @Property({ type: 'uuid', nullable: true })
  locationId?: string;

  @Property({ type: 'double' })
  factor!: number;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
