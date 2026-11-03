import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** This service's copy of a user's contact details, kept current from identity events. */
@Entity({ tableName: 'recipients' })
export class Recipient {
  @PrimaryKey({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  phone!: string;

  @Property({ type: 'text', nullable: true })
  email?: string;

  @Property({ type: 'json', nullable: true })
  prefs?: unknown;

  /** Set by the erasure flow (later): contact fields are blanked and nothing more is sent. */
  @Property({ type: 'Date', nullable: true })
  erasedAt?: Date;

  /** Timestamp of the event that last wrote this row; older events are ignored. */
  @Property({ type: 'Date' })
  updatedAt!: Date;
}
