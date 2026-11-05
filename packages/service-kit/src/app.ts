import { randomUUID } from 'node:crypto';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { LogController } from 'fastify';
import { Type } from 'typebox';
import { AppError } from './errors.js';

export interface AppOptions {
  serviceName: string;
  logLevel?: string;
  readyChecks?: (() => Promise<void>)[];
  /** Where log lines go; stdout when omitted. Tests pass a collector. */
  logStream?: { write(line: string): void };
}

/** The body of every error response. Declare it in each route's `response` schema. */
export const ErrorBody = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String() }),
});

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * Query `?ids=a,b`: comma-separated UUIDs, at most 100, for `/internal/*` lookups. The pattern
 * has no nested quantifiers (no backtracking risk).
 */
export const UuidListQuery = Type.Object({
  ids: Type.String({ pattern: `^${UUID}(,${UUID}){0,99}$` }),
});

declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean;
    /** Any valid token, no particular permission (e.g. `GET /users/me`). */
    authenticated?: boolean;
    permission?: string;
  }
}

const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.phone',
  '*.otp',
  '*.code',
  '*.password',
  '*.token',
  // Event envelopes nest the secrets one level deeper (`{ envelope: { payload: { code } } }`).
  '*.payload.phone',
  '*.payload.code',
  '*.payload.token',
];

function clientError(error: unknown): { status: number; code: string; message: string } | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    validation?: unknown;
  };
  if (typeof e.statusCode !== 'number' || e.statusCode < 400 || e.statusCode > 499) return null;
  return {
    status: e.statusCode,
    code:
      e.validation !== undefined
        ? 'VALIDATION'
        : typeof e.code === 'string'
          ? e.code
          : 'BAD_REQUEST',
    message: typeof e.message === 'string' ? e.message : 'Bad request',
  };
}

export function createApp(options: AppOptions) {
  const app = Fastify({
    logger:
      options.logLevel === 'silent'
        ? false
        : {
            level: options.logLevel ?? 'info',
            base: { service: options.serviceName },
            redact: REDACT,
            ...(options.logStream === undefined ? {} : { stream: options.logStream }),
          },
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && header.length > 0 ? header : randomUUID();
    },
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    bodyLimit: 1_048_576,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError && error.isOperational) {
      return reply
        .status(error.httpStatus)
        .send({ error: { code: error.code, message: error.message } });
    }
    const client = clientError(error);
    if (client !== null) {
      return reply
        .status(client.status)
        .send({ error: { code: client.code, message: client.message } });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );

  app.get('/health', { config: { public: true } }, () => ({ status: 'ok' as const }));

  app.get('/ready', { config: { public: true } }, async (_request, reply) => {
    try {
      await Promise.all((options.readyChecks ?? []).map((check) => check()));
      return { status: 'ready' as const };
    } catch {
      return reply
        .status(503)
        .send({ error: { code: 'NOT_READY', message: 'Dependency unavailable' } });
    }
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
