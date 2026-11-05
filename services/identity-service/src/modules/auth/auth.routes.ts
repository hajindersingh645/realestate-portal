import { ErrorBody, UnauthorizedError, type App, type Orm } from '@hanu/service-kit';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Type } from 'typebox';
import { refreshSession, revokeSession, type SessionTokens } from '../sessions/index.js';
import { LoginBody, OtpBody, TokenResponse } from './auth.schemas.js';
import { InvalidOtpError, login, startLogin, type AuthDeps, type Client } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';
// The browser sees the gateway path; the cookie goes only to the auth routes.
const COOKIE_PATH = '/api/v1/auth';

export function clientOf(request: FastifyRequest): Client {
  const userAgent = request.headers['user-agent'];
  return { ip: request.ip, ...(userAgent === undefined ? {} : { userAgent }) };
}

export function sendTokens(reply: FastifyReply, tokens: SessionTokens) {
  return reply
    .setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    })
    .send({ accessToken: tokens.accessToken, user: tokens.user });
}

function refreshCookie(request: FastifyRequest): string | null {
  return request.cookies.refresh_token ?? null;
}

const errors = { 400: ErrorBody, 401: ErrorBody, 403: ErrorBody, 429: ErrorBody };

export function registerAuthRoutes(app: App, deps: { orm: Orm; auth: AuthDeps }): void {
  app.post(
    '/auth/otp',
    {
      config: { public: true },
      schema: { body: OtpBody, response: { 202: Type.Null(), 400: ErrorBody, 429: ErrorBody } },
    },
    async (request, reply) => {
      await startLogin(deps.orm.em.fork(), deps.auth, request.body.phone);
      return reply.status(202).send(null);
    },
  );

  app.post(
    '/auth/login',
    {
      config: { public: true },
      schema: { body: LoginBody, response: { 200: TokenResponse, ...errors } },
    },
    async (request, reply) => {
      const result = await login(deps.orm.em.fork(), deps.auth, request.body, clientOf(request));
      if (!result.ok) throw new InvalidOtpError();
      return sendTokens(reply, result.tokens);
    },
  );

  app.post(
    '/auth/refresh',
    { config: { public: true }, schema: { response: { 200: TokenResponse, 401: ErrorBody } } },
    async (request, reply) => {
      const cookieValue = refreshCookie(request);
      if (cookieValue === null) throw new UnauthorizedError();
      const em = deps.orm.em.fork();
      const result = await em.transactional((tx) =>
        refreshSession(tx, deps.auth.signingKey, cookieValue),
      );
      if (!result.ok) throw new UnauthorizedError('Session ended. Log in again.');
      return sendTokens(reply, result.tokens);
    },
  );

  app.post(
    '/auth/logout',
    { config: { public: true }, schema: { response: { 204: Type.Null() } } },
    async (request, reply) => {
      const cookieValue = refreshCookie(request);
      if (cookieValue !== null) await revokeSession(deps.orm.em.fork(), cookieValue);
      return reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH }).status(204).send(null);
    },
  );
}
