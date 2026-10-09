import { randomUUID } from 'node:crypto';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { LogController } from 'fastify';
import { AppError } from './errors.js';

export interface AppOptions {
  serviceName: string;
  logLevel?: string;
  readyChecks?: (() => Promise<void>)[];
}

declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean;
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
