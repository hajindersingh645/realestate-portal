import type { Em, ServiceConfig } from '@hanu/service-kit';
import { listLocations, type LocationView } from '../locations/index.js';
import { listLookups, type LookupView } from '../lookups/index.js';
import { listPropertyTypes, type PropertyTypeView } from '../property-types/index.js';
import { listUnitConversions, type UnitConversionView } from '../unit-conversions/index.js';

export interface ReferenceData {
  platform: ServiceConfig['platform'];
  locations: LocationView[];
  propertyTypes: PropertyTypeView[];
  lookups: LookupView[];
  unitConversions: UnitConversionView[];
}

/**
 * Everything a client or another service needs to validate and label master data:
 * the active, non-deleted rows of every table plus the deployment's country, currency and units.
 */
export async function getReference(
  em: Em,
  platform: ServiceConfig['platform'],
): Promise<ReferenceData> {
  // One after another on purpose: an EntityManager runs one query at a time.
  const locations = await listLocations(em, { activeOnly: true });
  const propertyTypes = await listPropertyTypes(em, { activeOnly: true });
  const lookups = await listLookups(em, { activeOnly: true });
  const unitConversions = await listUnitConversions(em);
  return { platform, locations, propertyTypes, lookups, unitConversions };
}
