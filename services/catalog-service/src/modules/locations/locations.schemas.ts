import { LOCATION_TYPES } from '@hanu/contracts';
import { Type } from 'typebox';

const LocationTypeSchema = Type.Enum(LOCATION_TYPES);

export const LocationView = Type.Object({
  id: Type.String(),
  type: Type.String(),
  parentId: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  slug: Type.String(),
  code: Type.Union([Type.String(), Type.Null()]),
  lat: Type.Union([Type.Number(), Type.Null()]),
  lng: Type.Union([Type.Number(), Type.Null()]),
  isActive: Type.Boolean(),
  sort: Type.Integer(),
});

export const LocationList = Type.Object({ data: Type.Array(LocationView) });

const Lat = Type.Number({ minimum: -90, maximum: 90 });
const Lng = Type.Number({ minimum: -180, maximum: 180 });

export const CreateLocationBody = Type.Object({
  type: LocationTypeSchema,
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  slug: Type.String({ minLength: 1, maxLength: 80, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }),
  code: Type.Optional(Type.String({ pattern: '^[A-Z]{2,3}$' })),
  lat: Type.Optional(Lat),
  lng: Type.Optional(Lng),
  sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
});

/** `type`, `parentId`, `slug` and `code` are deliberately absent: they never change in this phase. */
export const UpdateLocationBody = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    lat: Type.Optional(Lat),
    lng: Type.Optional(Lng),
    sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
    isActive: Type.Optional(Type.Boolean()),
  },
  // At least one known field. Unknown keys (slug, code…) are dropped, so they cannot count.
  {
    additionalProperties: false,
    anyOf: [
      { required: ['name'] },
      { required: ['lat'] },
      { required: ['lng'] },
      { required: ['sort'] },
      { required: ['isActive'] },
    ],
  },
);

export const LocationParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export const ListLocationsQuery = Type.Object({
  type: Type.Optional(LocationTypeSchema),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
});
