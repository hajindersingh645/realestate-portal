import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import proxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';
import { AppError, createApp, NotFoundError, type App } from '@hanu/service-kit';
import { createPublicKey } from 'node:crypto';
import { decodeJwt, jwtVerify } from 'jose';
import type { RevocationList } from './revocation.js';

export interface GatewayRoute {
  prefix: string;
  /** Path prefix the upstream sees; '' strips `prefix`. */
  rewritePrefix: string;
  upstream: string;
  /** Requests per minute per IP on this prefix, instead of the global limit. */
  rateLimitMax?: number;
}

export interface GatewayOptions {
  routes: GatewayRoute[];
  corsOrigins: string[];
  rateLimitMax: number;
  logLevel?: string;
  /** Refuses access tokens issued before the user's access last changed. */
  revocation?: { publicKeyPem: string; list: RevocationList };
}

export class TokenRevokedError extends AppError {
  constructor() {
    super('TOKEN_REVOKED', 'Token revoked, refresh it', 401);
  }
}

/**
 * True when any path segment is `internal`. The path is decoded first, because the upstream
 * decodes it too: `/%69nternal/x` must be treated the same as `/internal/x`.
 */
function isInternalPath(url: string): boolean {
  const raw = url.split('?')[0] ?? '';
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return true; // malformed encoding: refuse instead of guessing
  }
  return path.toLowerCase().split(/[/\\]/).includes('internal');
}

export async function buildGateway(options: GatewayOptions): Promise<App> {
  const app = createApp({ serviceName: 'gateway', logLevel: options.logLevel });

  await app.register(helmet);
  await app.register(cors, { origin: options.corsOrigins, credentials: true });
  // ponytail: counters live in this process. Move to a shared store (Redis) when the
  // gateway runs as more than one instance (architecture.md section 14.4).
  await app.register(rateLimit, { max: options.rateLimitMax, timeWindow: '1 minute' });

  // Service-to-service routes are never reachable from outside.
  app.addHook('onRequest', (request, _reply, done) => {
    done(isInternalPath(request.url) ? new NotFoundError() : undefined);
  });

  if (options.revocation !== undefined) {
    const { list } = options.revocation;
    const key = createPublicKey(options.revocation.publicKeyPem);
    // Only a valid token is checked here. A missing or invalid one is the service's to refuse.
    app.addHook('onRequest', async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith('Bearer ') !== true) return;
      const token = header.slice(7);
      let claims: { sub?: string; iat?: number };
      try {
        claims = decodeJwt(token);
      } catch {
        return;
      }
      const { sub, iat } = claims;
      // Cheap check first: the signature is verified only for users on the list.
      if (sub === undefined || iat === undefined || !list.isRevoked(sub, iat)) return;
      try {
        await jwtVerify(token, key, { algorithms: ['EdDSA'] });
      } catch {
        return;
      }
      throw new TokenRevokedError();
    });
  }

  for (const route of options.routes) {
    await app.register(proxy, {
      upstream: route.upstream,
      prefix: route.prefix,
      rewritePrefix: route.rewritePrefix,
      config:
        route.rateLimitMax === undefined
          ? {}
          : { rateLimit: { max: route.rateLimitMax, timeWindow: '1 minute' } },
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => ({ ...headers, 'x-request-id': request.id }),
        // The upstream could not be reached or did not answer. Log the cause, tell the client only that.
        onError: (reply, { error }) => {
          reply.log.error({ err: error }, 'upstream request failed');
          void reply
            .status(503)
            .send({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Service unavailable' } });
        },
      },
    });
  }

  return app;
}
