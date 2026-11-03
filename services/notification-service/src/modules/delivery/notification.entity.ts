import { uuidv7 } from '@hanu/service-kit';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** One message per event, channel and template (unique), so a redelivered event sends nothing. */
@Entity({ tableName: 'notifications' })
export class Notification {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  eventId!: string;

  /** Null when the person has no account yet (signup code). */
  @Property({ type: 'uuid', nullable: true })
  userId?: string;

  /** `+91******3210`: enough to find the row, not enough to contact anyone. */
  @Property({ type: 'text' })
  phoneMasked!: string;

  @Property({ type: 'text' })
  channel!: string;

  @Property({ type: 'text' })
  templateCode!: string;

  /** sent | skipped_expired */
  @Property({ type: 'text' })
  status!: string;

  @Property({ type: 'text', nullable: true })
  providerMessageId?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
