import { REQUIREMENT_PURPOSES } from '@hanu/contracts';
import { actorOf, ErrorBody, UnauthorizedError, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  getPublicRequirement,
  listMyLeads,
  listPublicRequirements,
  listUnlocksForBuyer,
  unlockRequirement,
} from './leads.service.js';

const Str = Type.String();
const Null = <T extends ReturnType<typeof Type.String>>(s: T) => Type.Union([s, Type.Null()]);
const Uuid = Type.String({ format: 'uuid' });
const Cursor = Type.Optional(Type.String({ maxLength: 200 }));
/** Its own schema: no phone, email or buyer id can be added to it by accident. */
const Public = {
  id: Str,
  buyerName: Str,
  purpose: Str,
  propertyTypeId: Str,
  areas: Type.Array(Type.Object({ locationId: Str, cityId: Str })),
  budgetMin: Str,
  budgetMax: Str,
  bedrooms: Type.Array(Type.Integer()),
  areaMin: Null(Str),
  areaMax: Null(Str),
  areaUnit: Null(Str),
  possession: Null(Str),
  timeline: Null(Str),
  loanNeeded: Type.Union([Type.Boolean(), Type.Null()]),
  preferences: Type.Record(Str, Type.Union([Type.Boolean(), Str])),
  notes: Null(Str),
  publishedAt: Str,
  expiresAt: Str,
  unlockCount: Type.Integer(),
  maxUnlocks: Type.Integer(),
};
const PublicView = Type.Object(Public);
const Lead = Type.Object({
  ...Public,
  unlockId: Str,
  unlockedAt: Str,
  buyer: Type.Object({ name: Str, phone: Str }),
});
const page = <T extends ReturnType<typeof Type.Object>>(item: T) =>
  Type.Object({ data: Type.Array(item), nextCursor: Type.Union([Str, Type.Null()]) });
const Params = Type.Object({ id: Uuid });
const ERRORS = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };

export function registerLeadRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; identityUrl: string },
): void {
  const em = () => deps.orm.em.fork();

  app.get(
    '/lead/requirements',
    {
      config: { public: true },
      schema: {
        querystring: Type.Object({
          cityId: Type.Optional(Uuid),
          locationId: Type.Optional(Uuid),
          propertyTypeId: Type.Optional(Uuid),
          purpose: Type.Optional(Type.String({ enum: [...REQUIREMENT_PURPOSES] })),
          cursor: Cursor,
        }),
        response: { 200: page(PublicView), 400: ErrorBody },
      },
    },
    async (request) => await listPublicRequirements(em(), request.query),
  );

  app.get(
    '/lead/requirements/:id',
    {
      config: { public: true },
      schema: { params: Params, response: { 200: PublicView, 400: ErrorBody, 404: ErrorBody } },
    },
    async (request) => await getPublicRequirement(em(), request.params.id),
  );

  app.post(
    '/lead/requirements/:id/unlock',
    {
      config: { permission: 'lead.unlock' },
      schema: { params: Params, response: { 200: Lead, ...ERRORS } },
    },
    async (request) => {
      if (request.auth === undefined) throw new UnauthorizedError();
      return await unlockRequirement(
        em(),
        request.auth,
        actorOf(request, deps.serviceName),
        request.params.id,
      );
    },
  );

  app.get(
    '/lead/my-leads',
    {
      config: { permission: 'lead.unlock' },
      schema: {
        querystring: Type.Object({ cursor: Cursor }),
        response: { 200: page(Lead), ...ERRORS },
      },
    },
    async (request) => {
      if (request.auth === undefined) throw new UnauthorizedError();
      return await listMyLeads(em(), request.auth, request.query.cursor);
    },
  );

  app.get(
    '/lead/requirements/mine/:id/unlocks',
    {
      config: { permission: 'requirement.manage_own' },
      schema: {
        params: Params,
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                accountId: Str,
                unlockedAt: Str,
                slug: Null(Str),
                displayName: Null(Str),
                type: Null(Str),
                licenseNumber: Null(Str),
              }),
            ),
            namesUnavailable: Type.Boolean(),
          }),
          ...ERRORS,
        },
      },
    },
    async (request) => {
      if (request.auth === undefined) throw new UnauthorizedError();
      return await listUnlocksForBuyer(
        em(),
        request.auth.userId,
        request.params.id,
        deps.identityUrl,
      );
    },
  );
}
