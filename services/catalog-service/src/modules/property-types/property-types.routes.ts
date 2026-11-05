import { ErrorBody, type App, type Orm, actorOf } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  CreatePropertyTypeBody,
  PropertyTypeList,
  PropertyTypeParams,
  PropertyTypeView,
  UpdatePropertyTypeBody,
} from './property-types.schemas.js';
import {
  createPropertyType,
  deletePropertyType,
  listPropertyTypes,
  updatePropertyType,
} from './property-types.service.js';

const PERMISSION = 'admin.catalog.manage';

export function registerPropertyTypeRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string },
): void {
  app.get(
    '/admin/property-types',
    {
      config: { permission: PERMISSION },
      schema: { response: { 200: PropertyTypeList, 401: ErrorBody, 403: ErrorBody } },
    },
    async () => ({ data: await listPropertyTypes(deps.orm.em.fork(), {}) }),
  );

  app.post(
    '/admin/property-types',
    {
      config: { permission: PERMISSION },
      schema: {
        body: CreatePropertyTypeBody,
        response: {
          201: PropertyTypeView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const type = await createPropertyType(
        deps.orm.em.fork(),
        request.body,
        actorOf(request, deps.serviceName),
      );
      return reply.status(201).send(type);
    },
  );

  app.patch(
    '/admin/property-types/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: PropertyTypeParams,
        body: UpdatePropertyTypeBody,
        response: {
          200: PropertyTypeView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (request) =>
      await updatePropertyType(
        deps.orm.em.fork(),
        request.params.id,
        request.body,
        actorOf(request, deps.serviceName),
      ),
  );

  app.delete(
    '/admin/property-types/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: PropertyTypeParams,
        response: {
          204: Type.Null(),
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      await deletePropertyType(
        deps.orm.em.fork(),
        request.params.id,
        actorOf(request, deps.serviceName),
      );
      return reply.status(204).send(null);
    },
  );
}
