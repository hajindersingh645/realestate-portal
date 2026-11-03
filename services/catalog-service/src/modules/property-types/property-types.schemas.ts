import { PROPERTY_KINDS } from '@hanu/contracts';
import { Type } from 'typebox';

export const PropertyTypeView = Type.Object({
  id: Type.String(),
  parentId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  name: Type.String(),
  kind: Type.String(),
  isActive: Type.Boolean(),
  sort: Type.Integer(),
});

export const PropertyTypeList = Type.Object({ data: Type.Array(PropertyTypeView) });

export const CreatePropertyTypeBody = Type.Object({
  slug: Type.String({ minLength: 1, maxLength: 60, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  kind: Type.Enum(PROPERTY_KINDS),
  parentId: Type.Optional(Type.String({ format: 'uuid' })),
  sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
});

/** `slug` and `kind` are deliberately absent: they never change. */
export const UpdatePropertyTypeBody = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
    isActive: Type.Optional(Type.Boolean()),
  },
  // At least one known field. Unknown keys (slug, code…) are dropped, so they cannot count.
  {
    additionalProperties: false,
    anyOf: [{ required: ['name'] }, { required: ['sort'] }, { required: ['isActive'] }],
  },
);

export const PropertyTypeParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
