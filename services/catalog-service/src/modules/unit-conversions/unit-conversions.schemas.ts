import { Type } from 'typebox';

const Factor = Type.Number({ exclusiveMinimum: 0, maximum: 1_000_000_000 });

export const UnitConversionView = Type.Object({
  id: Type.String(),
  unitId: Type.String(),
  locationId: Type.Union([Type.String(), Type.Null()]),
  factor: Type.Number(),
});

export const UnitConversionList = Type.Object({ data: Type.Array(UnitConversionView) });

export const CreateUnitConversionBody = Type.Object({
  unitId: Type.String({ format: 'uuid' }),
  locationId: Type.Optional(Type.String({ format: 'uuid' })),
  factor: Factor,
});

/** Only the factor can change. To move a conversion to another unit or city, add a new one. */
export const UpdateUnitConversionBody = Type.Object({ factor: Factor });

export const UnitConversionParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
