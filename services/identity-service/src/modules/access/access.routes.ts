import { ErrorBody, type App, type Orm, actorOf } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  CreateRoleBody,
  OverrideBody,
  OverrideParams,
  RoleList,
  RoleParams,
  RoleView,
  UpdateRoleBody,
  UserRoleParams,
} from './access.schemas.js';
import { grantRole, removeOverride, revokeRole, setOverride } from './grants.service.js';
import { createRole, deleteRole, listRoles, updateRole } from './roles.service.js';

const config = { permission: 'admin.access.manage' };
const errors = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };
const BASE = '/admin/identity';

export function registerAccessRoutes(app: App, deps: { orm: Orm; serviceName: string }): void {
  const em = () => deps.orm.em.fork();

  app.get(
    `${BASE}/roles`,
    { config, schema: { response: { 200: RoleList, ...errors } } },
    async () => ({
      data: await listRoles(em()),
    }),
  );

  app.post(
    `${BASE}/roles`,
    { config, schema: { body: CreateRoleBody, response: { 201: RoleView, ...errors } } },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createRole(em(), actorOf(request, deps.serviceName), request.body)),
  );

  app.patch(
    `${BASE}/roles/:id`,
    {
      config,
      schema: { params: RoleParams, body: UpdateRoleBody, response: { 200: RoleView, ...errors } },
    },
    async (request) =>
      await updateRole(em(), actorOf(request, deps.serviceName), request.params.id, request.body),
  );

  app.delete(
    `${BASE}/roles/:id`,
    { config, schema: { params: RoleParams, response: { 204: Type.Null(), ...errors } } },
    async (request, reply) => {
      await deleteRole(em(), actorOf(request, deps.serviceName), request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.put(
    `${BASE}/users/:id/roles/:roleId`,
    { config, schema: { params: UserRoleParams, response: { 204: Type.Null(), ...errors } } },
    async (request, reply) => {
      await grantRole(
        em(),
        actorOf(request, deps.serviceName),
        request.params.id,
        request.params.roleId,
      );
      return reply.status(204).send(null);
    },
  );

  app.delete(
    `${BASE}/users/:id/roles/:roleId`,
    { config, schema: { params: UserRoleParams, response: { 204: Type.Null(), ...errors } } },
    async (request, reply) => {
      await revokeRole(
        em(),
        actorOf(request, deps.serviceName),
        request.params.id,
        request.params.roleId,
      );
      return reply.status(204).send(null);
    },
  );

  app.put(
    `${BASE}/users/:id/overrides/:permission`,
    {
      config,
      schema: {
        params: OverrideParams,
        body: OverrideBody,
        response: { 204: Type.Null(), ...errors },
      },
    },
    async (request, reply) => {
      const { id, permission } = request.params;
      await setOverride(em(), actorOf(request, deps.serviceName), id, permission, request.body);
      return reply.status(204).send(null);
    },
  );

  app.delete(
    `${BASE}/users/:id/overrides/:permission`,
    { config, schema: { params: OverrideParams, response: { 204: Type.Null(), ...errors } } },
    async (request, reply) => {
      const { id, permission } = request.params;
      await removeOverride(em(), actorOf(request, deps.serviceName), id, permission);
      return reply.status(204).send(null);
    },
  );
}
