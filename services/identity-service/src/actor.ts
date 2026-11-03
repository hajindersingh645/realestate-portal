import { UnauthorizedError, type Actor } from '@hanu/service-kit';
import type { FastifyRequest } from 'fastify';

/** Who is acting, for audit entries. Only guarded routes call this. */
export function actorOf(request: FastifyRequest, service: string): Actor {
  if (request.auth === undefined) throw new UnauthorizedError();
  return { service, userId: request.auth.userId, ip: request.ip };
}
