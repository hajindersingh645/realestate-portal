import { randomUUID } from 'node:crypto';
import {
  NotFoundError,
  sql,
  ValidationError,
  withDbErrors,
  type Em,
  type Actor,
} from '@hanu/service-kit';
import { emitReferenceChanged } from '../../reference-changed.js';
import { UnitConversion } from './unit-conversion.entity.js';

export interface UnitConversionView {
  id: string;
  unitId: string;
  locationId: string | null;
  factor: number;
}

export interface CreateUnitConversionInput {
  unitId: string;
  locationId?: string;
  factor: number;
}

const BAD_TARGET = 'The unit must be a live area unit, and the place (if given) a live city';

export function toUnitConversionView(conversion: UnitConversion): UnitConversionView {
  return {
    id: conversion.id,
    unitId: conversion.unitId,
    locationId: conversion.locationId ?? null,
    factor: conversion.factor,
  };
}

/** Soft-deleted rows are never returned (the `softDelete` filter). */
export async function listUnitConversions(em: Em): Promise<UnitConversionView[]> {
  const rows = await em.find(UnitConversion, {}, { orderBy: { unitId: 'asc', locationId: 'asc' } });
  return rows.map(toUnitConversionView);
}

/**
 * The insert itself checks what a foreign key cannot: the lookup is a live area unit and the
 * location, if given, is a live city. Zero rows inserted means one of those failed.
 */
export async function createUnitConversion(
  em: Em,
  input: CreateUnitConversionInput,
  actor: Actor,
): Promise<UnitConversionView> {
  const view: UnitConversionView = {
    id: randomUUID(),
    unitId: input.unitId,
    locationId: input.locationId ?? null,
    factor: input.factor,
  };
  return await withDbErrors(
    () =>
      em.transactional(async (tx) => {
        const rows = await sql(
          tx,
          `insert into unit_conversions (id, unit_id, location_id, factor, created_at, updated_at)
           select ?, ?, ?, ?, now(), now()
           where exists (
                   select 1 from lookups
                   where id = ? and "group" = 'area_unit' and deleted_at is null)
             and (?::uuid is null or exists (
                   select 1 from locations
                   where id = ? and type = 'city' and deleted_at is null))
           returning id`,
          [
            view.id,
            view.unitId,
            view.locationId,
            view.factor,
            view.unitId,
            view.locationId,
            view.locationId,
          ],
        );
        if (rows.length === 0) throw new ValidationError(BAD_TARGET);
        await emitReferenceChanged(tx, actor, 'unit_conversion', view.id, {
          action: 'created',
          after: view,
        });
        return view;
      }),
    {
      unique: 'This unit already has a conversion for this city (or a default)',
      reference: BAD_TARGET,
      check: 'The factor must be greater than zero',
    },
  );
}

export async function updateUnitConversion(
  em: Em,
  id: string,
  patch: { factor: number },
  actor: Actor,
): Promise<UnitConversionView> {
  return await withDbErrors(
    () =>
      em.transactional(async (tx) => {
        const conversion = await tx.findOne(UnitConversion, { id });
        if (conversion === null) throw new NotFoundError('Unit conversion not found');
        const before = toUnitConversionView(conversion);
        conversion.factor = patch.factor;
        await tx.flush();
        const after = toUnitConversionView(conversion);
        await emitReferenceChanged(tx, actor, 'unit_conversion', conversion.id, {
          action: 'updated',
          before,
          after,
        });
        return after;
      }),
    { check: 'The factor must be greater than zero' },
  );
}

/** Soft delete. A city whose override is deleted falls back to the default factor. */
export async function deleteUnitConversion(em: Em, id: string, actor: Actor): Promise<void> {
  await em.transactional(async (tx) => {
    const rows = await sql(
      tx,
      `update unit_conversions set deleted_at = now(), updated_at = now()
       where id = ? and deleted_at is null returning id`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundError('Unit conversion not found');
    await emitReferenceChanged(tx, actor, 'unit_conversion', id, { action: 'deleted' });
  });
}
