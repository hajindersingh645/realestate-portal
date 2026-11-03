import { randomUUID } from 'node:crypto';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** One logged-in device. The refresh token is `<id>.<secret>`; only sha256(secret) is stored. */
@Entity({ tableName: 'sessions' })
export class Session {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'text', hidden: true })
  refreshTokenHash!: string;

  @Property({ type: 'text', nullable: true })
  userAgent?: string;

  @Property({ type: 'text', nullable: true })
  ip?: string;

  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'Date', nullable: true })
  revokedAt?: Date;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', nullable: true })
  rotatedAt?: Date;
}
