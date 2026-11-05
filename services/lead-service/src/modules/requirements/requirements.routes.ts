import { actorOf, ErrorBody, type App, type Orm } from '@hanu/service-kit';
import {
  CreateRequirementBody,
  CursorQuery,
  IdParams,
  MyRequirementPage,
  MyRequirementView,
  SubmitBody,
  UpdateRequirementBody,
} from './requirements.schemas.js';
import {
  closeMyRequirement,
  createRequirement,
  getMyRequirement,
  listMyRequirements,
  submitMyRequirement,
  updateMyRequirement,
  type RequirementDeps,
} from './requirements.service.js';

const ERRORS = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };

/** The buyer's own requirements. Ownership comes from the token, never the URL. */
export function registerRequirementRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; requirements: RequirementDeps },
): void {
  const em = () => deps.orm.em.fork();

  app.post(
    '/lead/requirements',
    {
      config: { permission: 'requirement.create' },
      schema: {
        body: CreateRequirementBody,
        response: { 201: MyRequirementView, ...ERRORS, 503: ErrorBody },
      },
    },
    async (request, reply) => {
      const created = await createRequirement(
        em(),
        actorOf(request, deps.serviceName),
        deps.requirements,
        request.body,
      );
      return await reply.status(201).send(created);
    },
  );

  app.get(
    '/lead/requirements/mine',
    {
      config: { permission: 'requirement.manage_own' },
      schema: { querystring: CursorQuery, response: { 200: MyRequirementPage, ...ERRORS } },
    },
    async (request) =>
      await listMyRequirements(em(), actorOf(request, deps.serviceName), request.query.cursor),
  );

  app.get(
    '/lead/requirements/mine/:id',
    {
      config: { permission: 'requirement.manage_own' },
      schema: { params: IdParams, response: { 200: MyRequirementView, ...ERRORS } },
    },
    async (request) =>
      await getMyRequirement(em(), actorOf(request, deps.serviceName), request.params.id),
  );

  app.patch(
    '/lead/requirements/mine/:id',
    {
      config: { permission: 'requirement.manage_own' },
      schema: {
        params: IdParams,
        body: UpdateRequirementBody,
        response: { 200: MyRequirementView, ...ERRORS, 503: ErrorBody },
      },
    },
    async (request) =>
      await updateMyRequirement(
        em(),
        actorOf(request, deps.serviceName),
        deps.requirements,
        request.params.id,
        request.body,
      ),
  );

  app.post(
    '/lead/requirements/mine/:id/submit',
    {
      config: { permission: 'requirement.manage_own' },
      schema: {
        params: IdParams,
        body: SubmitBody,
        response: { 200: MyRequirementView, ...ERRORS },
      },
    },
    async (request) =>
      await submitMyRequirement(
        em(),
        actorOf(request, deps.serviceName),
        deps.requirements,
        request.params.id,
        request.body,
      ),
  );

  app.post(
    '/lead/requirements/mine/:id/close',
    {
      config: { permission: 'requirement.manage_own' },
      schema: { params: IdParams, response: { 200: MyRequirementView, ...ERRORS } },
    },
    async (request) =>
      await closeMyRequirement(em(), actorOf(request, deps.serviceName), request.params.id),
  );
}
