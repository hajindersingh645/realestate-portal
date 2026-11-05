import { randomUUID } from 'node:crypto';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/es';
import type { AccountStatus, AccountType } from '@hanu/contracts';

/**
 * A professional business: what pays, owns listings and appears publicly once approved.
 * A solo agent is an account with one owner. `slug` ends up in public URLs, so its unique
 * rule includes deleted rows and a slug is never given to another account.
 */
@Entity({ tableName: 'accounts' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
export class Account {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  type!: AccountType;

  @Property({ type: 'text' })
  displayName!: string;

  @Property({ type: 'text', unique: true })
  slug!: string;

  @Property({ type: 'text', nullable: true })
  about?: string;

  @Property({ type: 'integer', nullable: true })
  experienceYears?: number;

  @Property({ type: 'text[]' })
  specialisations: string[] = [];

  @Property({ type: 'text', nullable: true })
  licenseNumber?: string;

  @Property({ type: 'text' })
  status: AccountStatus = 'pending';

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}

/** Who belongs to an account. One active owner per account; one active membership per user. */
@Entity({ tableName: 'account_members' })
export class AccountMember {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'uuid' })
  accountId!: string;

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'text' })
  memberRole!: 'owner' | 'member';

  @Property({ type: 'text' })
  status: 'active' | 'removed' = 'active';

  @Property({ type: 'Date' })
  joinedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  removedAt?: Date;
}

/** Areas served. `cityId` is copied from catalog when saved, so directory filters need no call. */
@Entity({ tableName: 'account_locations' })
export class AccountLocation {
  @PrimaryKey({ type: 'uuid' })
  accountId!: string;

  @PrimaryKey({ type: 'uuid' })
  locationId!: string;

  @Property({ type: 'uuid' })
  cityId!: string;
}

/** Every status change of an account, with who and why. Append-only. */
@Entity({ tableName: 'account_transitions' })
export class AccountTransition {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  accountId!: string;

  @Property({ type: 'text', nullable: true })
  fromStatus?: AccountStatus;

  @Property({ type: 'text' })
  toStatus!: AccountStatus;

  @Property({ type: 'text', nullable: true })
  reason?: string;

  @Property({ type: 'uuid', nullable: true })
  actorUserId?: string;

  @Property({ type: 'Date' })
  createdAt = new Date();
}
