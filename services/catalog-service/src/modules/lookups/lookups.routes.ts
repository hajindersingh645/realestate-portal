import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  CreateLookupBody,
  ListLookupsQuery,
  LookupList,
  LookupParams,
  LookupView,
  UpdateLookupBody,
} from './lookups.schemas.js';
import { createLookup, deleteLookup, listLookups, updateLookup } from './lookups.service.js';

const PERMISSION = 'admin.catalog.manage';

export function registerLookupRoutes(app: App, deps: { orm: Orm; serviceName: string }): void {
  app.get(
    '/admin/lookups',
    {
      config: { permission: PERMISSION },
      schema: {
        querystring: ListLookupsQuery,
        response: { 200: LookupList, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
      },
    },
    async (request) => {
      const filter = request.query.group === undefined ? {} : { group: request.query.group };
      return { data: await listLookups(deps.orm.em.fork(), filter) };
    },
  );

  app.post(
    '/admin/lookups',
    {
      config: { permission: PERMISSION },
      schema: {
        body: CreateLookupBody,
        response: {
          201: LookupView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          409: ErrorBody,
        },
      },
    },
    async (request, reply) => {
      const lookup = await createLookup(deps.orm.em.fork(), request.body, deps.serviceName);
      return reply.status(201).send(lookup);
    },
  );

  app.patch(
    '/admin/lookups/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: LookupParams,
        body: UpdateLookupBody,
        response: {
          200: LookupView,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
        },
      },
    },
    async (request) =>
      await updateLookup(deps.orm.em.fork(), request.params.id, request.body, deps.serviceName),
  );

  app.delete(
    '/admin/lookups/:id',
    {
      config: { permission: PERMISSION },
      schema: {
        params: LookupParams,
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
      await deleteLookup(deps.orm.em.fork(), request.params.id, deps.serviceName);
      return reply.status(204).send(null);
    },
  );
}
