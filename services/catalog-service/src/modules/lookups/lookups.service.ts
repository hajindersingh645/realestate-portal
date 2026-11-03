import { NotFoundError, sql, withDbErrors, type Em } from '@hanu/service-kit';
import { emitReferenceChanged } from '../../reference-changed.js';
import { Lookup } from './lookup.entity.js';

export interface LookupView {
  id: string;
  group: string;
  code: string;
  label: string;
  meta: Record<string, unknown> | null;
  isActive: boolean;
  sort: number;
}

export interface CreateLookupInput {
  group: string;
  code: string;
  label: string;
  meta?: Record<string, unknown>;
  sort?: number;
}

export interface UpdateLookupInput {
  label?: string;
  meta?: Record<string, unknown>;
  sort?: number;
  isActive?: boolean;
}

export function toLookupView(lookup: Lookup): LookupView {
  return {
    id: lookup.id,
    group: lookup.group,
    code: lookup.code,
    label: lookup.label,
    meta: lookup.meta ?? null,
    isActive: lookup.isActive,
    sort: lookup.sort,
  };
}

/** Soft-deleted rows are never returned (the `softDelete` filter). */
export async function listLookups(
  em: Em,
  filter: { group?: string; activeOnly?: boolean },
): Promise<LookupView[]> {
  const rows = await em.find(
    Lookup,
    {
      ...(filter.group === undefined ? {} : { group: filter.group }),
      ...(filter.activeOnly === true ? { isActive: true } : {}),
    },
    { orderBy: { group: 'asc', sort: 'asc', label: 'asc' } },
  );
  return rows.map(toLookupView);
}

export async function createLookup(
  em: Em,
  input: CreateLookupInput,
  producer: string,
): Promise<LookupView> {
  return await withDbErrors(
    () =>
      em.transactional(async (tx) => {
        const lookup = new Lookup();
        lookup.group = input.group;
        lookup.code = input.code;
        lookup.label = input.label;
        lookup.meta = input.meta;
        lookup.sort = input.sort ?? 0;
        tx.persist(lookup);
        await tx.flush();
        await emitReferenceChanged(tx, producer, 'lookup', lookup.id);
        return toLookupView(lookup);
      }),
    { unique: 'A lookup with this group and code already exists' },
  );
}

export async function updateLookup(
  em: Em,
  id: string,
  patch: UpdateLookupInput,
  producer: string,
): Promise<LookupView> {
  return await em.transactional(async (tx) => {
    const lookup = await tx.findOne(Lookup, { id });
    if (lookup === null) throw new NotFoundError('Lookup not found');
    if (patch.label !== undefined) lookup.label = patch.label;
    if (patch.meta !== undefined) lookup.meta = patch.meta;
    if (patch.sort !== undefined) lookup.sort = patch.sort;
    if (patch.isActive !== undefined) lookup.isActive = patch.isActive;
    await tx.flush();
    await emitReferenceChanged(tx, producer, 'lookup', lookup.id);
    return toLookupView(lookup);
  });
}

/** Soft delete. The `where` makes a second delete of the same row a 404. */
export async function deleteLookup(em: Em, id: string, producer: string): Promise<void> {
  await em.transactional(async (tx) => {
    const rows = await sql(
      tx,
      `update lookups set deleted_at = now(), updated_at = now()
       where id = ? and deleted_at is null returning id`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundError('Lookup not found');
    await emitReferenceChanged(tx, producer, 'lookup', id);
  });
}
