# Hanu.property

Verified lead marketplace for real estate (Chandigarh Tricity). Microservices monorepo (pnpm workspaces).

## Stack

- Backend: Node.js (ESM), TypeScript, Fastify, TypeBox, MikroORM v7, Kysely, argon2
- Frontend: React (Vite), React Router (SSR for public pages), TanStack Query, Zustand, Tailwind CSS
- Infra: PostgreSQL, RabbitMQ (amqplib), Azure Blob Storage (Azurite locally), run via Colima

## Layout

- `apps/web` public site and dashboards · `apps/admin` staff panel
- `services/*` gateway, identity, catalog, notification, lead, listing, billing, handshake
- `packages/contracts` event schemas, permission keys, shared enums
- `packages/service-kit` auth, outbox/inbox, RabbitMQ, idempotency, internal HTTP client

## Rules that must hold

- A service reads and writes only its own Postgres schema. No cross-schema joins or foreign keys.
- Ask = HTTP `/internal/*` (timeout + idempotency key). Tell = event through the outbox.
- Service code never imports `amqplib`; use `outbox.add()` and `subscribe()` from the kit.
- Consumers must be safe to run twice.
- Limits and state changes are enforced in SQL (`WHERE` conditions, unique constraints), not in application `if`s.
- Every route has a TypeBox schema and either `permission` or `public: true`.
- Money is `bigint` in minor units, with no currency in column names (`amount`, `price`). Country, currency, locale and timezone come from `PLATFORM_*` env vars (one deployment per country).
- IDs are UUIDs. Prices, quotas and limits are settings rows, never constants.
- ID documents go to a private blob container. Listing media is public only while the listing is live.

## Naming

- Folders: kebab-case · DB tables and columns: snake_case · TypeScript: camelCase
- Exchanges: `domain.events` (topic) · Routing keys: `object.action` · Queues: `consumer-service.domain.action`

## Local defaults

- PostgreSQL: `postgresql://postgres:postgres@localhost:5433/real_estate` (one schema and role per service; host port 5433 so it does not clash with a Postgres already on 5432)
- RabbitMQ: `amqp://guest:guest@localhost:5672` · management UI `http://localhost:15672`

## Commands

- Infra up / down: `docker-compose up -d` / `docker-compose down`
- Install: `pnpm install`
- Build: `pnpm run build`
- Type check: `npx tsc --noEmit`
- Tests: `npx vitest run` (frontend: `--environment jsdom`)
- Security scan: `snyk test`
