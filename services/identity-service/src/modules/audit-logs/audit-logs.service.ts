import type { AuditRecordedPayload, EventEnvelope } from '@hanu/contracts';
import { decodeCursor, encodeCursor, sql, uuidv7, type Em } from '@hanu/service-kit';

/** Stores one `audit.recorded` event. Safe to run twice: `event_id` is unique. */
export async function recordAudit(
  em: Em,
  envelope: EventEnvelope<AuditRecordedPayload>,
): Promise<void> {
  const p = envelope.payload;
  await sql(
    em,
    `insert into audit_logs (id, event_id, actor_user_id, service, action, target_type, target_id, diff, ip, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
     on conflict (event_id) do nothing`,
    [
      uuidv7(),
      envelope.eventId,
      p.actorUserId,
      p.service,
      p.action,
      p.targetType,
      p.targetId,
      p.diff === null ? null : JSON.stringify(p.diff),
      p.ip,
      envelope.timestamp,
    ],
  );
}

export interface AuditLogView {
  id: string;
  actorUserId: string | null;
  service: string;
  action: string;
  targetType: string;
  targetId: string;
  diff: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditFilter {
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  /** `nextCursor` of the previous page. */
  cursor?: string;
}

const PAGE = 50;

/** Newest first, 50 per page, keyset paging on (created_at, id). */
export async function listAuditLogs(
  em: Em,
  filter: AuditFilter,
): Promise<{ data: AuditLogView[]; nextCursor: string | null }> {
  const [cursorAt, cursorId] =
    filter.cursor === undefined ? [null, null] : decodeCursor(filter.cursor);
  const rows = await sql<AuditLogView>(
    em,
    `select id, actor_user_id as "actorUserId", service, action, target_type as "targetType",
            target_id as "targetId", diff, ip,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt"
       from audit_logs
      where (?::text is null or target_type = ?)
        and (?::text is null or target_id = ?)
        and (?::uuid is null or actor_user_id = ?::uuid)
        and (?::timestamptz is null or (created_at, id) < (?::timestamptz, ?::uuid))
      order by created_at desc, id desc
      limit ${String(PAGE + 1)}`,
    [
      filter.targetType ?? null,
      filter.targetType ?? null,
      filter.targetId ?? null,
      filter.targetId ?? null,
      filter.actorUserId ?? null,
      filter.actorUserId ?? null,
      cursorAt,
      cursorAt,
      cursorId,
    ],
  );
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);
  const nextCursor =
    rows.length > PAGE && last !== undefined ? encodeCursor(last.createdAt, last.id) : null;
  return { data: page, nextCursor };
}
