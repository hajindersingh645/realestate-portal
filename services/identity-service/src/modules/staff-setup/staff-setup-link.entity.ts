import { randomUUID } from 'node:crypto';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/**
 * A one-time link a staff member opens to set their password. Only sha256(token) is stored.
 * `closedAt` is set when the link is used or replaced by a newer one.
 */
@Entity({ tableName: 'staff_setup_links' })
export class StaffSetupLink {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'text', hidden: true, unique: true })
  tokenHash!: string;

  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'Date', nullable: true })
  closedAt?: Date;

  @Property({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
