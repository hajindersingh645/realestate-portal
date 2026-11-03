import { randomUUID } from 'node:crypto';
import type { LocationType } from '@hanu/contracts';
import {
  ConflictError,
  NotFoundError,
  sql,
  ValidationError,
  withDbErrors,
  type Em,
  type Actor,
} from '@hanu/service-kit';
import { emitReferenceChanged } from '../../reference-changed.js';
import { Location } from './location.entity.js';

export interface LocationView {
  id: string;
  type: string;
  parentId: string | null;
  name: string;
  slug: string;
  code: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  sort: number;
}

export interface CreateLocationInput {
  type: LocationType;
  parentId?: string;
  name: string;
  slug: string;
  code?: string;
  lat?: number;
  lng?: number;
  sort?: number;
}

export interface UpdateLocationInput {
  name?: string;
  lat?: number;
  lng?: number;
  sort?: number;
  isActive?: boolean;
}

const BAD_PARENT = 'The parent location does not exist or is not the right kind of location';

/** The type a location's parent must have. The database enforces it through a composite foreign key. */
export function parentTypeOf(type: LocationType): LocationType | null {
  if (type === 'city') return 'state';
  if (type === 'locality') return 'city';
  return null;
}

export function toLocationView(location: Location): LocationView {
  return {
    id: location.id,
    type: location.type,
    parentId: location.parentId ?? null,
    name: location.name,
    slug: location.slug,
    code: location.code ?? null,
    lat: location.lat ?? null,
    lng: location.lng ?? null,
    isActive: location.isActive,
    sort: location.sort,
  };
}

/** Soft-deleted rows are never returned (the `softDelete` filter). */
export async function listLocations(
  em: Em,
  filter: { type?: string; parentId?: string; activeOnly?: boolean },
): Promise<LocationView[]> {
  const rows = await em.find(
    Location,
    {
      ...(filter.type === undefined ? {} : { type: filter.type }),
      ...(filter.parentId === undefined ? {} : { parentId: filter.parentId }),
      ...(filter.activeOnly === true ? { isActive: true } : {}),
    },
    { orderBy: { type: 'asc', sort: 'asc', name: 'asc' } },
  );
  return rows.map(toLocationView);
}

/**
 * The hierarchy is checked by the database (composite foreign key and check constraint).
 * The foreign key cannot see `deleted_at`, so the insert itself also requires a live parent.
 */
export async function createLocation(
  em: Em,
  input: CreateLocationInput,
  actor: Actor,
): Promise<LocationView> {
  const view: LocationView = {
    id: randomUUID(),
    type: input.type,
    parentId: input.parentId ?? null,
    name: input.name,
    slug: input.slug,
    code: input.code ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    isActive: true,
    sort: input.sort ?? 0,
  };
  // Only set when a parent is given, so a parentless city fails the hierarchy check, not this code.
  const parentType = view.parentId === null ? null : parentTypeOf(input.type);
  return await withDbErrors(
    () =>
      em.transactional(async (tx) => {
        const rows = await sql(
          tx,
          `insert into locations
             (id, type, parent_id, parent_type, name, slug, code, lat, lng, is_active, sort, created_at, updated_at)
           select ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, now(), now()
           where ?::uuid is null
              or exists (select 1 from locations where id = ? and deleted_at is null)
           returning id`,
          [
            view.id,
            view.type,
            view.parentId,
            parentType,
            view.name,
            view.slug,
            view.code,
            view.lat,
            view.lng,
            view.sort,
            view.parentId,
            view.parentId,
          ],
        );
        if (rows.length === 0) throw new ValidationError(BAD_PARENT);
        await emitReferenceChanged(tx, actor, 'location', view.id, {
          action: 'created',
          after: view,
        });
        return view;
      }),
    {
      unique: 'A location with this slug already exists here',
      reference: BAD_PARENT,
      check:
        'This location does not fit the hierarchy: a state has no parent, a city sits under a state, a locality under a city',
    },
  );
}

export async function updateLocation(
  em: Em,
  id: string,
  patch: UpdateLocationInput,
  actor: Actor,
): Promise<LocationView> {
  return await em.transactional(async (tx) => {
    const location = await tx.findOne(Location, { id });
    if (location === null) throw new NotFoundError('Location not found');
    const before = toLocationView(location);
    if (patch.name !== undefined) location.name = patch.name;
    if (patch.lat !== undefined) location.lat = patch.lat;
    if (patch.lng !== undefined) location.lng = patch.lng;
    if (patch.sort !== undefined) location.sort = patch.sort;
    if (patch.isActive !== undefined) location.isActive = patch.isActive;
    await tx.flush();
    const after = toLocationView(location);
    await emitReferenceChanged(tx, actor, 'location', location.id, {
      action: 'updated',
      before,
      after,
    });
    return after;
  });
}

/** Soft delete, refused while a live child (city or locality) still sits under this location. */
export async function deleteLocation(em: Em, id: string, actor: Actor): Promise<void> {
  await em.transactional(async (tx) => {
    const rows = await sql(
      tx,
      `update locations set deleted_at = now(), updated_at = now()
       where id = ? and deleted_at is null
         and not exists (select 1 from locations c where c.parent_id = ? and c.deleted_at is null)
       returning id`,
      [id, id],
    );
    if (rows.length === 0) {
      const live = await sql(tx, 'select 1 from locations where id = ? and deleted_at is null', [
        id,
      ]);
      if (live.length > 0) throw new ConflictError('Delete the places under it first');
      throw new NotFoundError('Location not found');
    }
    await emitReferenceChanged(tx, actor, 'location', id, { action: 'deleted' });
  });
}
