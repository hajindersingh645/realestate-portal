import { randomUUID } from 'node:crypto';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/es';

/**
 * A person: buyer, professional or staff. Phone and email uniqueness are partial indexes
 * (live rows only) added in the migration, so a deleted user's phone can sign up again.
 */
@Entity({ tableName: 'users' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** buyer | professional | staff: how they signed up; permissions decide what they may do. */
  @Property({ type: 'text' })
  registeredAs!: string;

  @Property({ type: 'text' })
  name!: string;

  /** E.164, e.g. +919815012345. */
  @Property({ type: 'text' })
  phone!: string;

  @Property({ type: 'Date', nullable: true })
  phoneVerifiedAt?: Date;

  @Property({ type: 'text', nullable: true })
  email?: string;

  @Property({ type: 'Date', nullable: true })
  emailVerifiedAt?: Date;

  /** argon2id. Staff only. */
  @Property({ type: 'text', nullable: true, hidden: true })
  passwordHash?: string;

  /** active | suspended | banned */
  @Property({ type: 'text' })
  status = 'active';

  /** none | pending | verified | rejected; 'none' throughout version 1. */
  @Property({ type: 'text' })
  kycStatus = 'none';

  /** The data-protection notice version they agreed to; set once content blocks exist. */
  @Property({ type: 'uuid', nullable: true })
  noticeBlockId?: string;

  @Property({ type: 'Date', nullable: true })
  consentedAt?: Date;

  @Property({ type: 'Date', nullable: true })
  erasedAt?: Date;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
