import {
  REQUIREMENT_DECISIONS,
  REQUIREMENT_STATUSES,
  type RequirementDecision,
  type RequirementStatus,
} from '@hanu/contracts';
import { actorOf, ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import {
  countRequirementsForStaff,
  decideRequirement,
  getRequirementForStaff,
  listRequirementsForStaff,
} from './moderation.service.js';

const Status = Type.Unsafe<RequirementStatus>(Type.String({ enum: [...REQUIREMENT_STATUSES] }));
const Nullable = (schema: ReturnType<typeof Type.String>) => Type.Union([schema, Type.Null()]);
const Str = Type.String();
const Row = {
  id: Str,
  status: Status,
  purpose: Str,
  propertyTypeId: Str,
  cityIds: Type.Array(Str),
  budgetMin: Str,
  budgetMax: Str,
  buyerName: Nullable(Str),
  submittedAt: Nullable(Str),
  createdAt: Str,
};
const View = Type.Object({
  ...Row,
  buyerId: Str,
  buyerPhone: Nullable(Str),
  areas: Type.Array(Type.Object({ locationId: Str, cityId: Str })),
  bedrooms: Type.Array(Type.Integer()),
  areaMin: Nullable(Str),
  areaMax: Nullable(Str),
  areaUnit: Nullable(Str),
  possession: Nullable(Str),
  timeline: Nullable(Str),
  loanNeeded: Type.Union([Type.Boolean(), Type.Null()]),
  preferences: Type.Record(Str, Type.Union([Type.Boolean(), Str])),
  notes: Nullable(Str),
  unlockCount: Type.Integer(),
  maxUnlocks: Type.Union([Type.Integer(), Type.Null()]),
  feeType: Nullable(Str),
  publishedAt: Nullable(Str),
  expiresAt: Nullable(Str),
  transitions: Type.Array(
    Type.Object({
      fromStatus: Nullable(Str),
      toStatus: Str,
      reason: Nullable(Str),
      actorUserId: Nullable(Str),
      createdAt: Str,
    }),
  ),
});
const Search = Type.Optional(Type.String({ maxLength: 100 }));
const ListQuery = Type.Object({
  status: Type.Optional(Status),
  q: Search,
  cursor: Type.Optional(Type.String({ maxLength: 200 })),
});
const Counts = Type.Object(
  Object.fromEntries(
    [...REQUIREMENT_STATUSES.filter((s) => s !== 'draft'), 'all'].map((k) => [k, Type.Integer()]),
  ),
);
const DecisionBody = Type.Object(
  {
    action: Type.Unsafe<RequirementDecision>(Type.String({ enum: [...REQUIREMENT_DECISIONS] })),
    reason: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);
const Params = Type.Object({ id: Type.String({ format: 'uuid' }) });
const ERRORS = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 404: ErrorBody, 409: ErrorBody };
const permission = 'admin.lead.moderate';

/** Staff review of requirements. Drafts never reach staff. */
export function registerModerationRoutes(
  app: App,
  deps: { orm: Orm; serviceName: string; timeZone: string },
): void {
  const em = () => deps.orm.em.fork();

  app.get(
    '/lead/admin/requirements',
    {
      config: { permission },
      schema: {
        querystring: ListQuery,
        response: {
          200: Type.Object({
            data: Type.Array(Type.Object(Row)),
            nextCursor: Type.Union([Str, Type.Null()]),
          }),
          ...ERRORS,
        },
      },
    },
    async (request) => await listRequirementsForStaff(em(), request.query),
  );

  // Before `/:id`, so "counts" is not read as an id.
  app.get(
    '/lead/admin/requirements/counts',
    {
      config: { permission },
      schema: { querystring: Type.Object({ q: Search }), response: { 200: Counts, ...ERRORS } },
    },
    async (request) => await countRequirementsForStaff(em(), request.query.q),
  );

  app.get(
    '/lead/admin/requirements/:id',
    { config: { permission }, schema: { params: Params, response: { 200: View, ...ERRORS } } },
    async (request) => await getRequirementForStaff(em(), request.params.id),
  );

  app.post(
    '/lead/admin/requirements/:id/decision',
    {
      config: { permission },
      schema: { params: Params, body: DecisionBody, response: { 200: View, ...ERRORS } },
    },
    async (request) =>
      await decideRequirement(
        em(),
        actorOf(request, deps.serviceName),
        request.params.id,
        request.body.action,
        request.body.reason,
        deps.timeZone,
      ),
  );
}
