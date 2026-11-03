import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  CreateLocationBody,
  ListLocationsQuery,
  LocationList,
  LocationParams,
  LocationView,
  UpdateLocationBody,
} from './locations.schemas.js';
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
} from './locations.service.js';

const PERMISSION = 'admin.catalog.manage';

export function registerLocationRoutes(app: App, deps: { orm: Orm; serviceName: string }): void {
  app.get(
    '/admin/locations',
    {
      config: { permission: PERMISSION },
      schema: {
        querystring: ListLocationsQuery,
        response: { 200: LocationList, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (request) => {
      const { type, parentId } = request.query;
      const filter = {
        ...(type === undefined ? {} : { type }),
        ...(parentId === undefined ? {} : { parentId }),
      };
      return { data: await listLocations(deps.orm.em.fork(), filter) };
    },
  );

  app.post(
    '/admin/locations',
    {
      config: { permission: PERMISSION },
      schema: {
        body: CreateLocationBody,
        response: {
          201: LocationView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const location = await createLocation(deps.orm.em.fork(), request.body, deps.serviceName);
      return reply.status(201).send(location);
    },
  );

  app.patch(
    '/admin/locations/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: LocationParams,
        body: UpdateLocationBody,
        response: {
          200: LocationView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (request) =>
      await updateLocation(deps.orm.em.fork(), request.params.id, request.body, deps.serviceName),
  );

  app.delete(
    '/admin/locations/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: LocationParams,
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
      await deleteLocation(deps.orm.em.fork(), request.params.id, deps.serviceName);
      return reply.status(204).send(null);
    },
  );
}
