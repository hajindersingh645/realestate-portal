import {
  REQUIREMENT_PURPOSES,
  REQUIREMENT_STATUSES,
  type RequirementPurpose,
  type RequirementStatus,
} from '@hanu/contracts';
import { Type, type Static } from 'typebox';

const Uuid = Type.String({ format: 'uuid' });
// `enum` keeps the literal types (a Union built with `.map` is typed `never`).
const Purpose = Type.Unsafe<RequirementPurpose>(Type.String({ enum: [...REQUIREMENT_PURPOSES] }));
export const RequirementStatusSchema = Type.Unsafe<RequirementStatus>(
  Type.String({ enum: [...REQUIREMENT_STATUSES] }),
);
/** Money in minor units, sent as a string so bigints survive JSON. */
const Money = Type.String({ pattern: '^[0-9]{1,15}$' });
/** An area as typed (up to 2 decimals), in `areaUnit`. */
const AreaValue = Type.String({ pattern: '^[0-9]{1,8}(\\.[0-9]{1,2})?$' });
const Code = Type.String({ minLength: 1, maxLength: 40, pattern: '^[a-z0-9_]+$' });
const Preferences = Type.Record(
  Type.String({ pattern: '^[a-zA-Z0-9_]{1,40}$' }),
  Type.Union([Type.Boolean(), Type.String({ maxLength: 200 })]),
  { maxProperties: 20 },
);

const fields = {
  purpose: Purpose,
  propertyTypeId: Uuid,
  locationIds: Type.Array(Uuid, { minItems: 1, maxItems: 10 }),
  budgetMin: Money,
  budgetMax: Money,
  bedrooms: Type.Optional(
    Type.Array(Type.Integer({ minimum: 0, maximum: 10 }), { maxItems: 11, uniqueItems: true }),
  ),
  areaMin: Type.Optional(AreaValue),
  areaMax: Type.Optional(AreaValue),
  areaUnit: Type.Optional(Code),
  possession: Type.Optional(Code),
  timeline: Type.Optional(Code),
  loanNeeded: Type.Optional(Type.Boolean()),
  preferences: Type.Optional(Preferences),
  notes: Type.Optional(Type.String({ maxLength: 1000 })),
};

export const CreateRequirementBody = Type.Object(fields, { additionalProperties: false });
export type RequirementInput = Static<typeof CreateRequirementBody>;

export const UpdateRequirementBody = Type.Partial(Type.Object(fields), {
  additionalProperties: false,
  minProperties: 1,
});
export type RequirementUpdate = Static<typeof UpdateRequirementBody>;

export const SubmitBody = Type.Object({ consent: Type.Boolean() }, { additionalProperties: false });

const Nullable = <T extends Parameters<typeof Type.Union>[0][number]>(schema: T) =>
  Type.Union([schema, Type.Null()]);
const Time = Nullable(Type.String());

export const MyRequirementView = Type.Object({
  id: Type.String(),
  status: RequirementStatusSchema,
  purpose: Purpose,
  propertyTypeId: Type.String(),
  areas: Type.Array(Type.Object({ locationId: Type.String(), cityId: Type.String() })),
  budgetMin: Type.String(),
  budgetMax: Type.String(),
  bedrooms: Type.Array(Type.Integer()),
  areaMin: Nullable(Type.String()),
  areaMax: Nullable(Type.String()),
  areaUnit: Nullable(Type.String()),
  possession: Nullable(Type.String()),
  timeline: Nullable(Type.String()),
  loanNeeded: Nullable(Type.Boolean()),
  preferences: Type.Record(Type.String(), Type.Union([Type.Boolean(), Type.String()])),
  notes: Nullable(Type.String()),
  unlockCount: Type.Integer(),
  maxUnlocks: Nullable(Type.Integer()),
  feeType: Nullable(Type.String()),
  submittedAt: Time,
  publishedAt: Time,
  expiresAt: Time,
  closedAt: Time,
  createdAt: Type.String(),
  /** The latest staff reason, only while the requirement is rejected. */
  rejectReason: Nullable(Type.String()),
});
export type MyRequirement = Static<typeof MyRequirementView>;

export const MyRequirementPage = Type.Object({
  data: Type.Array(MyRequirementView),
  nextCursor: Nullable(Type.String()),
});

export const IdParams = Type.Object({ id: Uuid });
export const CursorQuery = Type.Object({ cursor: Type.Optional(Type.String({ maxLength: 200 })) });
