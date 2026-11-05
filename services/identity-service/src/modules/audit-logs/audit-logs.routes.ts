import { ErrorBody, type App, type Orm } from '@hanu/service-kit';
import { Type } from 'typebox';
import { listAuditLogs } from './audit-logs.service.js';

const Query = Type.Object({
  targetType: Type.Optional(Type.String({ maxLength: 64 })),
  targetId: Type.Optional(Type.String({ maxLength: 64 })),
  actorUserId: Type.Optional(Type.String({ format: 'uuid' })),
  cursor: Type.Optional(Type.String({ maxLength: 200 })),
});

const AuditLogView = Type.Object({
  id: Type.String(),
  actorUserId: Type.Union([Type.String(), Type.Null()]),
  service: Type.String(),
  action: Type.String(),
  targetType: Type.String(),
  targetId: Type.String(),
  diff: Type.Unknown(),
  ip: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export function registerAuditLogRoutes(app: App, deps: { orm: Orm }): void {
  app.get(
    '/admin/identity/audit-logs',
    {
      config: { permission: 'admin.audit.view' },
      schema: {
        querystring: Query,
        response: {
          200: Type.Object({
            data: Type.Array(AuditLogView),
            nextCursor: Type.Union([Type.String(), Type.Null()]),
          }),
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
        },
      },
    },
    async (request) => await listAuditLogs(deps.orm.em.fork(), request.query),
  );
}
