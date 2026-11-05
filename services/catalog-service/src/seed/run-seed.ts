import { randomUUID } from 'node:crypto';
import { sql, type Em } from '@hanu/service-kit';
import { emitReferenceChanged } from '../reference-changed.js';
import { TRICITY_SEED } from './tricity.js';

export interface SeedResult {
  locations: number;
  propertyTypes: number;
  lookups: number;
  unitConversions: number;
  contentBlocks: number;
}

interface IdRow {
  id: string;
}

interface SeedLocationRow {
  type: string;
  parentId: string | null;
  parentType: string | null;
  name: string;
  slug: string;
  code: string | null;
  sort: number;
}

/** Inserts a location unless one with this parent and slug exists. Returns its id and whether it was new. */
async function location(em: Em, row: SeedLocationRow): Promise<{ id: string; inserted: boolean }> {
  const inserted = await sql<IdRow>(
    em,
    `insert into locations (id, type, parent_id, parent_type, name, slug, code, is_active, sort, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, true, ?, now(), now())
     on conflict do nothing returning id`,
    [randomUUID(), row.type, row.parentId, row.parentType, row.name, row.slug, row.code, row.sort],
  );
  if (inserted[0] !== undefined) return { id: inserted[0].id, inserted: true };
  const existing = await sql<IdRow>(
    em,
    'select id from locations where slug = ? and parent_id is not distinct from ?',
    [row.slug, row.parentId],
  );
  if (existing[0] === undefined) {
    throw new Error(`Seed: location ${row.slug} could not be inserted or found`);
  }
  return { id: existing[0].id, inserted: false };
}

/**
 * Loads the launch master data. Call inside a transaction.
 * Existing rows are never changed, so admin edits survive a re-run, and a row staff
 * soft-deleted is never brought back (unique rules include deleted rows; conversions are
 * checked explicitly because their unique rule does not).
 */
export async function runSeed(em: Em, producer: string, locale: string): Promise<SeedResult> {
  const result: SeedResult = {
    locations: 0,
    propertyTypes: 0,
    lookups: 0,
    unitConversions: 0,
    contentBlocks: 0,
  };

  for (const [stateIndex, state] of TRICITY_SEED.states.entries()) {
    const savedState = await location(em, {
      type: 'state',
      parentId: null,
      parentType: null,
      name: state.name,
      slug: state.slug,
      code: state.code,
      sort: stateIndex + 1,
    });
    if (savedState.inserted) result.locations += 1;

    for (const city of state.cities) {
      const savedCity = await location(em, {
        type: 'city',
        parentId: savedState.id,
        parentType: 'state',
        name: city.name,
        slug: city.slug,
        code: null,
        sort: city.sort,
      });
      if (savedCity.inserted) result.locations += 1;

      for (const [localityIndex, locality] of city.localities.entries()) {
        const savedLocality = await location(em, {
          type: 'locality',
          parentId: savedCity.id,
          parentType: 'city',
          name: locality.name,
          slug: locality.slug,
          code: null,
          sort: localityIndex + 1,
        });
        if (savedLocality.inserted) result.locations += 1;
      }
    }
  }

  // Parents first, so a child can look its parent up by slug.
  const types = [...TRICITY_SEED.propertyTypes].sort(
    (a, b) => Number('parent' in a) - Number('parent' in b),
  );
  for (const type of types) {
    const parentSlug = 'parent' in type ? type.parent : null;
    const inserted = await sql<IdRow>(
      em,
      `insert into property_types (id, parent_id, slug, name, kind, is_active, sort, created_at, updated_at)
       values (?, (select id from property_types where slug = ?), ?, ?, ?, true, ?, now(), now())
       on conflict do nothing returning id`,
      [randomUUID(), parentSlug, type.slug, type.name, type.kind, type.sort],
    );
    result.propertyTypes += inserted.length;
  }

  for (const lookup of TRICITY_SEED.lookups) {
    const inserted = await sql<IdRow>(
      em,
      `insert into lookups (id, "group", code, label, is_active, sort, created_at, updated_at)
       values (?, ?, ?, ?, true, ?, now(), now())
       on conflict do nothing returning id`,
      [randomUUID(), lookup.group, lookup.code, lookup.label, lookup.sort],
    );
    result.lookups += inserted.length;
  }

  for (const conversion of TRICITY_SEED.unitConversions) {
    const inserted = await sql<IdRow>(
      em,
      `insert into unit_conversions (id, unit_id, location_id, factor, created_at, updated_at)
       select ?, l.id, null, ?, now(), now() from lookups l
       where l."group" = 'area_unit' and l.code = ? and l.deleted_at is null
         and not exists (
           select 1 from unit_conversions u where u.unit_id = l.id and u.location_id is null)
       on conflict do nothing returning id`,
      [randomUUID(), conversion.factor, conversion.unit],
    );
    result.unitConversions += inserted.length;
  }

  // Placeholder notice so sign-up works on a new deployment; staff replace it in the admin panel.
  // Only when the key has no version yet in this locale.
  const notice = await sql<IdRow>(
    em,
    `insert into content_blocks (id, key, locale, version, body, links, created_at)
     select ?, 'signup.data_notice', ?, 1, ?, ?::jsonb, now()
      where not exists (
        select 1 from content_blocks where key = 'signup.data_notice' and locale = ?)
     returning id`,
    [
      randomUUID(),
      locale,
      TRICITY_SEED.dataNotice.body,
      JSON.stringify(TRICITY_SEED.dataNotice.links),
      locale,
    ],
  );
  result.contentBlocks += notice.length;

  const total =
    result.locations +
    result.propertyTypes +
    result.lookups +
    result.unitConversions +
    result.contentBlocks;
  // One event for the whole load: consumers reload everything on any reference.changed.
  // Audited once, with no user: the seed is run from the command line.
  const actor = { service: producer, userId: null, ip: null };
  if (total > 0) {
    await emitReferenceChanged(em, actor, 'location', randomUUID(), {
      action: 'seeded',
      after: result,
    });
  }
  return result;
}
