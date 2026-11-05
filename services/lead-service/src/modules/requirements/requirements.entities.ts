import { randomUUID } from 'node:crypto';
import type { RequirementPurpose, RequirementStatus } from '@hanu/contracts';
import { uuidv7 } from '@hanu/service-kit';
import { Entity, Filter, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es';

/**
 * What a buyer is looking for. Public once `live`, without any way to contact the buyer.
 * Money (`budgetMin`, `budgetMax`) is in minor units of the platform currency.
 */
@Entity({ tableName: 'requirements' })
@Filter({ name: 'softDelete', cond: { deletedAt: null }, default: true })
@Index({ properties: ['status', 'publishedAt', 'id'] })
@Index({ properties: ['buyerId', 'createdAt'] })
export class Requirement {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'uuid' })
  buyerId!: string;

  @Property({ type: 'text' })
  status: RequirementStatus = 'draft';

  @Property({ type: 'text' })
  purpose!: RequirementPurpose;

  @Property({ type: 'uuid' })
  propertyTypeId!: string;

  @Property({ type: 'bigint' })
  budgetMin!: bigint;

  @Property({ type: 'bigint' })
  budgetMax!: bigint;

  @Property({ type: 'integer[]', columnType: 'integer[]', defaultRaw: `'{}'` })
  bedrooms: number[] = [];

  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  areaMin?: string;

  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  areaMax?: string;

  @Property({ type: 'text', nullable: true })
  areaUnit?: string;

  @Property({ type: 'text', nullable: true })
  possession?: string;

  @Property({ type: 'text', nullable: true })
  timeline?: string;

  @Property({ type: 'boolean', nullable: true })
  loanNeeded?: boolean;

  @Property({ type: 'json', defaultRaw: `'{}'` })
  preferences: Record<string, unknown> = {};

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'integer' })
  unlockCount = 0;

  /** Copied from `lead.maxUnlocks` at publish, so a later setting change leaves it alone. */
  @Property({ type: 'integer', nullable: true })
  maxUnlocks?: number;

  @Property({ type: 'text', nullable: true })
  feeType?: 'free' | 'paid';

  @Property({ type: 'Date', nullable: true })
  consentedAt?: Date;

  @Property({ type: 'Date', nullable: true })
  submittedAt?: Date;

  @Property({ type: 'Date', nullable: true })
  publishedAt?: Date;

  @Property({ type: 'Date', nullable: true })
  expiresAt?: Date;

  @Property({ type: 'Date', nullable: true })
  closedAt?: Date;

  @Property({ type: 'Date' })
  createdAt = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}

/** Where the buyer is looking. The city is copied from catalog so city filters need no call. */
@Entity({ tableName: 'requirement_locations' })
@Index({ properties: ['cityId'] })
@Index({ properties: ['locationId'] })
export class RequirementLocation {
  @PrimaryKey({ type: 'uuid' })
  requirementId!: string;

  @PrimaryKey({ type: 'uuid' })
  locationId!: string;

  @Property({ type: 'uuid' })
  cityId!: string;
}

/** A professional account that took the buyer's contact. At most one per requirement. */
@Entity({ tableName: 'lead_unlocks' })
@Unique({ properties: ['requirementId', 'accountId'] })
@Index({ properties: ['accountId', 'unlockedAt'] })
export class LeadUnlock {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  requirementId!: string;

  @Property({ type: 'uuid' })
  accountId!: string;

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'text' })
  status = 'active';

  /** `free` only while `lead.unlock.free` is on (Phase 3); Phase 4 adds quota and points. */
  @Property({ type: 'text' })
  chargeSource!: string;

  @Property({ type: 'Date' })
  unlockedAt = new Date();
}

/** The buyer's name and phone, copied from identity at publish and kept current by events. */
@Entity({ tableName: 'buyer_contacts' })
export class BuyerContact {
  @PrimaryKey({ type: 'uuid' })
  buyerId!: string;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  phone!: string;

  @Property({ type: 'Date' })
  updatedAt = new Date();
}
