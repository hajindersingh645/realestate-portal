import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  NotFoundError,
  sql,
  ValidationError,
  withDbErrors,
  type Em,
} from '@hanu/service-kit';
import { emitReferenceChanged } from '../../reference-changed.js';
import { PropertyType } from './property-type.entity.js';

export interface PropertyTypeView {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  kind: string;
  isActive: boolean;
  sort: number;
}

export interface CreatePropertyTypeInput {
  slug: string;
  name: string;
  kind: string;
  parentId?: string;
  sort?: number;
}

export interface UpdatePropertyTypeInput {
  name?: string;
  sort?: number;
  isActive?: boolean;
}

export function toPropertyTypeView(type: PropertyType): PropertyTypeView {
  return {
    id: type.id,
    parentId: type.parentId ?? null,
    slug: type.slug,
    name: type.name,
    kind: type.kind,
    isActive: type.isActive,
    sort: type.sort,
  };
}

/** Soft-deleted rows are never returned (the `softDelete` filter). */
export async function listPropertyTypes(
  em: Em,
  filter: { activeOnly?: boolean },
): Promise<PropertyTypeView[]> {
  const rows = await em.find(PropertyType, filter.activeOnly === true ? { isActive: true } : {}, {
    orderBy: { sort: 'asc', name: 'asc' },
  });
  return rows.map(toPropertyTypeView);
}

/**
 * The foreign key cannot see `deleted_at`, so the insert itself requires a live parent:
 * zero rows inserted means the parent is missing or deleted.
 */
export async function createPropertyType(
  em: Em,
  input: CreatePropertyTypeInput,
  producer: string,
): Promise<PropertyTypeView> {
  const view: PropertyTypeView = {
    id: randomUUID(),
    parentId: input.parentId ?? null,
    slug: input.slug,
    name: input.name,
    kind: input.kind,
    isActive: true,
    sort: input.sort ?? 0,
  };
  return await withDbErrors(
    () =>
      em.transactional(async (tx) => {
        const rows = await sql(
          tx,
          `insert into property_types (id, parent_id, slug, name, kind, is_active, sort, created_at, updated_at)
           select ?, ?, ?, ?, ?, true, ?, now(), now()
           where ?::uuid is null
              or exists (select 1 from property_types where id = ? and deleted_at is null)
           returning id`,
          [
            view.id,
            view.parentId,
            view.slug,
            view.name,
            view.kind,
            view.sort,
            view.parentId,
            view.parentId,
          ],
        );
        if (rows.length === 0) {
          throw new ValidationError('The parent property type does not exist');
        }
        await emitReferenceChanged(tx, producer, 'property_type', view.id);
        return view;
      }),
    {
      unique: 'A property type with this slug already exists',
      reference: 'The parent property type does not exist',
    },
  );
}

export async function updatePropertyType(
  em: Em,
  id: string,
  patch: UpdatePropertyTypeInput,
  producer: string,
): Promise<PropertyTypeView> {
  return await em.transactional(async (tx) => {
    const type = await tx.findOne(PropertyType, { id });
    if (type === null) throw new NotFoundError('Property type not found');
    if (patch.name !== undefined) type.name = patch.name;
    if (patch.sort !== undefined) type.sort = patch.sort;
    if (patch.isActive !== undefined) type.isActive = patch.isActive;
    await tx.flush();
    await emitReferenceChanged(tx, producer, 'property_type', type.id);
    return toPropertyTypeView(type);
  });
}

/** Soft delete, refused while a live sub-type still points at this one. */
export async function deletePropertyType(em: Em, id: string, producer: string): Promise<void> {
  await em.transactional(async (tx) => {
    const rows = await sql(
      tx,
      `update property_types set deleted_at = now(), updated_at = now()
       where id = ? and deleted_at is null
         and not exists (select 1 from property_types c where c.parent_id = ? and c.deleted_at is null)
       returning id`,
      [id, id],
    );
    if (rows.length === 0) {
      const live = await sql(
        tx,
        'select 1 from property_types where id = ? and deleted_at is null',
        [id],
      );
      if (live.length > 0) throw new ConflictError('Delete or move its sub-types first');
      throw new NotFoundError('Property type not found');
    }
    await emitReferenceChanged(tx, producer, 'property_type', id);
  });
}
