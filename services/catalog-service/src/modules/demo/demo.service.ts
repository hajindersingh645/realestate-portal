import { EXCHANGES, ROUTING_KEYS, type DemoPingedPayload } from '@hanu/contracts';
import { NotFoundError, outboxAdd, sql, type Em } from '@hanu/service-kit';
import { DemoPing } from './demo-ping.entity.js';

export async function createPing(
  em: Em,
  input: { note: string; fail: boolean },
  producer: string,
): Promise<string> {
  return await em.transactional(async (tx) => {
    const ping = new DemoPing();
    ping.note = input.note;
    tx.persist(ping);
    await tx.flush();

    const payload: DemoPingedPayload = { pingId: ping.id, fail: input.fail };
    await outboxAdd(tx, {
      exchange: EXCHANGES.catalog,
      routingKey: ROUTING_KEYS.demoPinged,
      producer,
      payload,
    });
    return ping.id;
  });
}

export async function getPing(em: Em, id: string): Promise<DemoPing> {
  const ping = await em.findOne(DemoPing, { id });
  if (ping === null) throw new NotFoundError('Ping not found');
  return ping;
}

export async function markReceived(em: Em, pingId: string): Promise<void> {
  await sql(em, 'update demo_pings set received_at = now() where id = ? and received_at is null', [
    pingId,
  ]);
}
