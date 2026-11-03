import { EXCHANGES, ROUTING_KEYS, type AuditRecordedPayload } from '@hanu/contracts';
import { createOutboxRelay, subscribe, type Orm, type RabbitConnection } from '@hanu/service-kit';
import { recordAudit } from './modules/audit-logs/index.js';

/** Outbox relay, and the audit consumer for every service that records actions. */
export async function startMessaging(deps: {
  orm: Orm;
  connection: RabbitConnection;
  onError?: (error: unknown) => void;
}) {
  const relay = createOutboxRelay({
    orm: deps.orm,
    connection: deps.connection,
    onError: deps.onError,
  });
  const audit = await subscribe<AuditRecordedPayload>({
    orm: deps.orm,
    connection: deps.connection,
    queue: 'identity-service.audit.recorded',
    // Add a service's exchange here when it starts calling audit().
    exchange: [EXCHANGES.identity, EXCHANGES.catalog],
    keys: [ROUTING_KEYS.auditRecorded],
    handler: async (envelope, em) => {
      await recordAudit(em, envelope);
    },
    ...(deps.onError === undefined ? {} : { onError: deps.onError }),
  });
  return {
    relay,
    async stop(): Promise<void> {
      await audit.close();
      await relay.stop();
    },
  };
}
