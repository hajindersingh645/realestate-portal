import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  type AccountStatus,
  type AccountType,
} from '@hanu/contracts';
import { Type } from 'typebox';

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
