import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import proxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';
import { createApp, NotFoundError, type App } from '@hanu/service-kit';

export interface GatewayRoute {
  prefix: string;
  upstream: string;
}

export interface GatewayOptions {
  routes: GatewayRoute[];
  corsOrigins: string[];
  rateLimitMax: number;
  logLevel?: string;
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

  for (const route of options.routes) {
    await app.register(proxy, {
      upstream: route.upstream,
      prefix: route.prefix,
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
