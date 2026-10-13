import { randomUUID } from 'node:crypto';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/es';

@Entity({ tableName: 'demo_pings' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class DemoPing {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'string' })
  note!: string;

  @Property({ type: 'Date', nullable: true })
  receivedAt?: Date;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
