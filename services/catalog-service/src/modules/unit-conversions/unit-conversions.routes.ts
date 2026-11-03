import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  CreateUnitConversionBody,
  UnitConversionList,
  UnitConversionParams,
  UnitConversionView,
  UpdateUnitConversionBody,
} from './unit-conversions.schemas.js';
import {
  createUnitConversion,
  deleteUnitConversion,
  listUnitConversions,
  updateUnitConversion,
} from './unit-conversions.service.js';

const PERMISSION = 'admin.catalog.manage';

export function registerUnitConversionRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string },
): void {
  app.get(
    '/admin/unit-conversions',
    {
      config: { permission: PERMISSION },
      schema: { response: { 200: UnitConversionList, 401: ErrorBody, 403: ErrorBody } },
    },
    async () => ({ data: await listUnitConversions(deps.orm.em.fork()) }),
  );

  app.post(
    '/admin/unit-conversions',
    {
      config: { permission: PERMISSION },
      schema: {
        body: CreateUnitConversionBody,
        response: {
          201: UnitConversionView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const conversion = await createUnitConversion(
        deps.orm.em.fork(),
        request.body,
        deps.serviceName,
      );
      return reply.status(201).send(conversion);
    },
  );

  app.patch(
    '/admin/unit-conversions/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: UnitConversionParams,
        body: UpdateUnitConversionBody,
        response: {
          200: UnitConversionView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (request) =>
      await updateUnitConversion(
        deps.orm.em.fork(),
        request.params.id,
        request.body,
        deps.serviceName,
      ),
  );

  app.delete(
    '/admin/unit-conversions/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: UnitConversionParams,
        response: {
          204: Type.Null(),
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      await deleteUnitConversion(deps.orm.em.fork(), request.params.id, deps.serviceName);
      return reply.status(204).send(null);
    },
  );
}
