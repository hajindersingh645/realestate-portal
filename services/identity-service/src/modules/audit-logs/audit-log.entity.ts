import { uuidv7 } from '@hanu/service-kit';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * One recorded action from any service. Append-only: the runtime role cannot update or delete
 * rows. `event_id` is unique so a redelivered `audit.recorded` is stored once.
 */
@Entity({ tableName: 'audit_logs' })
export class AuditLog {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Unique()
  @Property({ type: 'uuid' })
  eventId!: string;

  @Property({ type: 'uuid', nullable: true })
  actorUserId?: string;

  @Property({ type: 'text' })
  service!: string;

  @Property({ type: 'text' })
  action!: string;

  @Property({ type: 'text' })
  targetType!: string;

  @Property({ type: 'text' })
  targetId!: string;

  @Property({ type: 'json', nullable: true })
  diff?: unknown;

  @Property({ type: 'text', nullable: true })
  ip?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
