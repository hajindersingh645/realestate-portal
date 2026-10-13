import { createPublicKey } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import { ForbiddenError, UnauthorizedError } from './errors.js';

export interface AuthContext {
  userId: string;
  accountId?: string;
  perms: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function registerAuth(app: FastifyInstance, options: { publicKeyPem: string }): void {
  const key = createPublicKey(options.publicKeyPem);

  app.addHook('onRoute', (route) => {
    const config = route.config;
    if (config?.public !== true && typeof config?.permission !== 'string') {
      throw new Error(
        `Route ${String(route.method)} ${route.url} must declare config.permission or config.public`,
      );
    }
  });

  // onRequest runs before the body is parsed or validated, so an anonymous caller
  // gets 401 without learning anything about the route's schema.
  app.addHook('onRequest', async (request) => {
    if (request.is404) return;
    const config = request.routeOptions.config;
    if (config.public === true) return;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ') !== true) throw new UnauthorizedError();

    let claims: Record<string, unknown>;
    try {
      const verified = await jwtVerify(header.slice(7), key, { algorithms: ['EdDSA'] });
      claims = verified.payload;
    } catch {
      throw new UnauthorizedError();
    }
    if (typeof claims.sub !== 'string') throw new UnauthorizedError();

    const perms = Array.isArray(claims.perms)
      ? claims.perms.filter((p): p is string => typeof p === 'string')
      : [];
    request.auth = {
      userId: claims.sub,
      accountId: typeof claims.acc === 'string' ? claims.acc : undefined,
      perms,
    };

    if (config.permission !== undefined && !perms.includes(config.permission)) {
      throw new ForbiddenError();
    }
  });
}
