import { Type } from 'typebox';
import { LocationViewSchema } from '../locations/index.js';
import { LookupViewSchema } from '../lookups/index.js';
import { PropertyTypeViewSchema } from '../property-types/index.js';
import { UnitConversionViewSchema } from '../unit-conversions/index.js';

export const ReferenceResponse = Type.Object({
  platform: Type.Object({
    country: Type.String(),
    currency: Type.String(),
    locale: Type.String(),
    timezone: Type.String(),
    areaBaseUnit: Type.String(),
  }),
  locations: Type.Array(LocationViewSchema),
  propertyTypes: Type.Array(PropertyTypeViewSchema),
  lookups: Type.Array(LookupViewSchema),
  unitConversions: Type.Array(UnitConversionViewSchema),
});
