import { LOOKUP_GROUPS } from '@hanu/contracts';
import { Type } from 'typebox';

const Group = Type.Enum(LOOKUP_GROUPS);
const Meta = Type.Record(Type.String(), Type.Unknown());

export const LookupView = Type.Object({
  id: Type.String(),
  group: Type.String(),
  code: Type.String(),
  label: Type.String(),
  meta: Type.Union([Meta, Type.Null()]),
  isActive: Type.Boolean(),
  sort: Type.Integer(),
});

export const LookupList = Type.Object({ data: Type.Array(LookupView) });

export const CreateLookupBody = Type.Object({
  group: Group,
  code: Type.String({ minLength: 1, maxLength: 50, pattern: '^[a-z0-9_]+$' }),
  label: Type.String({ minLength: 1, maxLength: 100 }),
  meta: Type.Optional(Meta),
  sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
});

/** `group` and `code` are deliberately absent: they never change. */
export const UpdateLookupBody = Type.Object(
  {
    label: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    meta: Type.Optional(Meta),
    sort: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
    isActive: Type.Optional(Type.Boolean()),
  },
  // At least one known field. Unknown keys (slug, code…) are dropped, so they cannot count.
  {
    additionalProperties: false,
    anyOf: [
      { required: ['label'] },
      { required: ['meta'] },
      { required: ['sort'] },
      { required: ['isActive'] },
    ],
  },
);

export const LookupParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export const ListLookupsQuery = Type.Object({ group: Type.Optional(Group) });
