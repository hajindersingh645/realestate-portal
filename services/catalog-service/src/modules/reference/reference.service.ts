import type { Em, ServiceConfig } from '@hanu/service-kit';
import { currentContentBlocks } from '../content-blocks/index.js';
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
  notices: Record<
    string,
    { id: string; version: number; body: string; links: { label: string; url: string }[] }
  >;
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
  const blocks = await currentContentBlocks(em, platform.locale);
  const notices = Object.fromEntries(
    Object.entries(blocks).map(([key, b]) => [
      key,
      { id: b.id, version: b.version, body: b.body, links: b.links },
    ]),
  );
  return { platform, locations, propertyTypes, lookups, unitConversions, notices };
}
