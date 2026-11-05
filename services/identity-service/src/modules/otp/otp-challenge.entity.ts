import { randomUUID } from 'node:crypto';
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/** One OTP sent to a phone. Limits (attempts, resends, lock) are enforced in SQL on these rows. */
@Entity({ tableName: 'otp_challenges' })
@Index({ properties: ['phone', 'purpose', 'createdAt'] })
export class OtpChallenge {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  phone!: string;

  /** login | staff_login */
  @Property({ type: 'text' })
  purpose!: string;

  /** HMAC-SHA256 of the code with OTP_SECRET. The code itself is never stored. */
  @Property({ type: 'text', hidden: true })
  codeHash!: string;

  @Property({ type: 'Date' })
  expiresAt!: Date;

  @Property({ type: 'integer' })
  attempts = 0;

  @Property({ type: 'Date', nullable: true })
  lockedUntil?: Date;

  @Property({ type: 'Date', nullable: true })
  consumedAt?: Date;

  /** For staff_login: the user whose password was checked. */
  @Property({ type: 'uuid', nullable: true })
  userId?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
