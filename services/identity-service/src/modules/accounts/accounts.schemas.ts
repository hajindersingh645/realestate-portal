import {
  ACCOUNT_DECISIONS,
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  type AccountDecision,
  type AccountStatus,
  type AccountType,
} from '@hanu/contracts';
import { Type, type TSchema } from 'typebox';

const Uuid = Type.String({ format: 'uuid' });
// `enum` keeps the literal types (a Union built with `.map` is typed `never`).
const AccountTypeSchema = Type.Unsafe<AccountType>(Type.String({ enum: [...ACCOUNT_TYPES] }));
const AccountStatusSchema = Type.Unsafe<AccountStatus>(
  Type.String({ enum: [...ACCOUNT_STATUSES] }),
);
const DisplayName = Type.String({ minLength: 2, maxLength: 80 });
const About = Type.String({ maxLength: 2000 });
const ExperienceYears = Type.Integer({ minimum: 0, maximum: 70 });
const Specialisations = Type.Array(Type.String({ minLength: 1, maxLength: 40 }), { maxItems: 10 });
const LicenseNumber = Type.String({ minLength: 1, maxLength: 40 });
const LocationIds = Type.Array(Uuid, { minItems: 1, maxItems: 50 });
const Slug = Type.String({ minLength: 2, maxLength: 60, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' });

export const CreateAccountBody = Type.Object(
  {
    type: AccountTypeSchema,
    displayName: DisplayName,
    about: Type.Optional(About),
    experienceYears: Type.Optional(ExperienceYears),
    specialisations: Type.Optional(Specialisations),
    licenseNumber: Type.Optional(LicenseNumber),
    locationIds: LocationIds,
  },
  { additionalProperties: false },
);

/** Type and status are not editable here: type is chosen once, status belongs to staff. */
export const UpdateAccountBody = Type.Object(
  {
    displayName: Type.Optional(DisplayName),
    about: Type.Optional(About),
    experienceYears: Type.Optional(ExperienceYears),
    specialisations: Type.Optional(Specialisations),
    licenseNumber: Type.Optional(LicenseNumber),
    locationIds: Type.Optional(LocationIds),
    slug: Type.Optional(Slug),
  },
  // At least one known field. Unknown keys (status, type…) are dropped, so they cannot count.
  {
    additionalProperties: false,
    anyOf: [
      'displayName',
      'about',
      'experienceYears',
      'specialisations',
      'licenseNumber',
      'locationIds',
      'slug',
    ].map((field) => ({ required: [field] })),
  },
);

export const MyAccountView = Type.Object({
  id: Type.String(),
  type: AccountTypeSchema,
  displayName: Type.String(),
  slug: Type.String(),
  about: Type.Union([Type.String(), Type.Null()]),
  experienceYears: Type.Union([Type.Integer(), Type.Null()]),
  specialisations: Type.Array(Type.String()),
  licenseNumber: Type.Union([Type.String(), Type.Null()]),
  status: AccountStatusSchema,
  areas: Type.Array(Type.Object({ locationId: Type.String(), cityId: Type.String() })),
  rejectReason: Type.Union([Type.String(), Type.Null()]),
  license: Type.Object({ label: Type.String(), mandatory: Type.Boolean() }),
});

const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const Areas = Type.Array(Type.Object({ locationId: Type.String(), cityId: Type.String() }));
const Cursor = Type.String({ minLength: 1, maxLength: 200 });

export const DecisionBody = Type.Object(
  {
    action: Type.Unsafe<AccountDecision>(Type.String({ enum: [...ACCOUNT_DECISIONS] })),
    reason: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

export const AccountIdParams = Type.Object({ id: Uuid });

export const StaffAccountQuery = Type.Object({
  status: Type.Optional(AccountStatusSchema),
  type: Type.Optional(AccountTypeSchema),
  q: Type.Optional(Type.String({ maxLength: 80 })),
  cursor: Type.Optional(Cursor),
});

const Owner = { userId: Type.String(), name: Type.String(), phone: Type.String() };

export const StaffAccountList = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      type: AccountTypeSchema,
      displayName: Type.String(),
      slug: Type.String(),
      status: AccountStatusSchema,
      createdAt: Type.String(),
      owner: Type.Object(Owner),
    }),
  ),
  nextCursor: Nullable(Type.String()),
});

export const StaffAccountView = Type.Object({
  id: Type.String(),
  type: AccountTypeSchema,
  displayName: Type.String(),
  slug: Type.String(),
  about: Nullable(Type.String()),
  experienceYears: Nullable(Type.Integer()),
  specialisations: Type.Array(Type.String()),
  licenseNumber: Nullable(Type.String()),
  status: AccountStatusSchema,
  createdAt: Type.String(),
  owner: Type.Object({ ...Owner, email: Nullable(Type.String()) }),
  areas: Areas,
  transitions: Type.Array(
    Type.Object({
      fromStatus: Nullable(AccountStatusSchema),
      toStatus: AccountStatusSchema,
      reason: Nullable(Type.String()),
      actorUserId: Nullable(Type.String()),
      actorName: Nullable(Type.String()),
      createdAt: Type.String(),
    }),
  ),
});

export const ProfessionalQuery = Type.Object({
  cityId: Type.Optional(Uuid),
  locationId: Type.Optional(Uuid),
  type: Type.Optional(AccountTypeSchema),
  cursor: Type.Optional(Cursor),
});

export const SlugParams = Type.Object({ slug: Type.String({ minLength: 1, maxLength: 60 }) });

/** The public profile: no owner name, phone or email. */
export const PublicProfessional = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  type: AccountTypeSchema,
  displayName: Type.String(),
  about: Nullable(Type.String()),
  experienceYears: Nullable(Type.Integer()),
  specialisations: Type.Array(Type.String()),
  licenseNumber: Nullable(Type.String()),
  areas: Areas,
});

export const ProfessionalList = Type.Object({
  data: Type.Array(PublicProfessional),
  nextCursor: Nullable(Type.String()),
});

export const StaffAccountCountQuery = Type.Object({
  type: Type.Optional(AccountTypeSchema),
  q: Type.Optional(Type.String({ maxLength: 80 })),
});

export const StaffAccountCounts = Type.Object({
  pending: Type.Integer(),
  approved: Type.Integer(),
  rejected: Type.Integer(),
  suspended: Type.Integer(),
  banned: Type.Integer(),
  all: Type.Integer(),
});
