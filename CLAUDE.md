# Hanu.property

Verified lead marketplace for real estate (Chandigarh Tricity). Microservices monorepo (pnpm workspaces).

## Stack

- Backend: Node.js (ESM), TypeScript, Fastify, TypeBox, MikroORM v7, Kysely, argon2, jose
- Frontend: React (Vite), React Router (SSR for public pages), TanStack Query, Zustand, Tailwind CSS
- Infra: PostgreSQL, RabbitMQ (amqplib), Azure Blob Storage (Azurite locally), run via Colima
- Tooling: Node.js 24 LTS; TypeScript 7 native for `tsc`, with `typescript` aliased to 6.0 for ESLint and other tools; ESLint, Prettier, Vitest

## Layout

- `apps/web` buyer and professional dashboard (the public site is a separate front end) · `apps/admin` staff panel
- `services/*` gateway, identity, catalog, notification, lead, listing, billing, handshake
- `packages/contracts` event schemas, permission keys, shared enums
- `packages/service-kit` auth, outbox/inbox, RabbitMQ, idempotency, internal HTTP client, keyset cursors
- `packages/web-kit` shared React UI kit, API client and session store for both apps

## Rules that must hold

- A service reads and writes only its own Postgres schema. No cross-schema joins or foreign keys.
- Ask = HTTP `/internal/*` (timeout + idempotency key). Tell = event through the outbox.
- Service code never imports `amqplib`; use `outbox.add()` and `subscribe()` from the kit.
- Consumers must be safe to run twice.
- Limits and state changes are enforced in SQL (`WHERE` conditions, unique constraints), not in application `if`s.
- Every route has a TypeBox schema and one of `permission`, `authenticated: true` (any signed-in user) or `public: true`.
- Money is `bigint` in minor units, with no currency in column names (`amount`, `price`). Country, currency, locale and timezone come from `PLATFORM_*` env vars (one deployment per country).
- IDs are UUIDs. Prices, quotas and limits are settings rows, never constants.
- All `@mikro-orm/*` packages share one exact version (no `^`).
- ID documents go to a private blob container. Listing media is public only while the listing is live.

## Naming

- Folders: kebab-case · DB tables and columns: snake_case · TypeScript: camelCase
- Exchanges: `domain.events` (topic) · Routing keys: `object.action` · Queues: `consumer-service.domain.action`

## Local defaults

- PostgreSQL: `postgresql://postgres:postgres@localhost:5433/real_estate` (host port 5433 so it does not clash with a Postgres already on 5432). One schema and two roles per service: `svc_<s>` owns the schema and runs migrations (`MIGRATION_DATABASE_URL`); `svc_<s>_app` is what the service runs as (`DATABASE_URL`) and cannot update or delete append-only tables
- RabbitMQ: `amqp://guest:guest@localhost:5672` · management UI `http://localhost:15672`

## Commands

- Infra up / down: `docker-compose up -d` / `docker-compose down` (Colima must be running)
- Install: `pnpm install`
- Migrate all services: `pnpm migrate`
- Seed master data: `pnpm seed` (safe to repeat)
- Draft a migration from entity changes: `pnpm --filter <service> migration:create --name <what>`, then `pnpm format`, read it, and add the class to `MIGRATIONS` in `orm.ts`
- Run all services: `pnpm dev` (gateway :3000, identity-service :3001, catalog-service :3002, notification-service :3006, admin panel http://localhost:5174, dashboard http://localhost:5175)
- identity-service calls catalog directly at `CATALOG_INTERNAL_URL` (`/internal/locations`), never through the gateway
- In development the admin and the dashboard share the localhost refresh cookie: use a private window for one of them
- Staff setup links are built from identity-service's `ADMIN_URL`; the admin copies the link from the panel and sends it by hand
- Lint and format check: `pnpm lint` · fix formatting: `pnpm format`
- Type check: `pnpm typecheck`
- Unit and route tests: `pnpm test`
- Integration tests (need infra; stop `pnpm dev` first): `pnpm test:int`
- First super admin (asks for the password): `pnpm --filter identity-service create-admin --email <e> --phone <p> --name <n>`
- OTP codes in development: printed by notification-service (`sms to …`)
- Security scan: `snyk test`
