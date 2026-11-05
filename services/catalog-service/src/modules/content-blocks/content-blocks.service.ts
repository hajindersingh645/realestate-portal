import { sql, type Actor, type Em } from '@hanu/service-kit';
import { emitReferenceChanged } from '../../reference-changed.js';

export interface ContentBlockLink {
  label: string;
  url: string;
}

export interface ContentBlockView {
  id: string;
  key: string;
  locale: string;
  version: number;
  body: string;
  links: ContentBlockLink[];
  createdAt: string;
}

export interface PublishContentBlockInput {
  key: string;
  locale: string;
  body: string;
  links: ContentBlockLink[];
}

interface Row {
  id: string;
  key: string;
  locale: string;
  version: number;
  body: string;
  links: ContentBlockLink[];
  created_at: Date;
}

const COLUMNS = 'id, key, locale, version, body, links, created_at';

function toView(row: Row): ContentBlockView {
  return {
    id: row.id,
    key: row.key,
    locale: row.locale,
    version: row.version,
    body: row.body,
    links: row.links,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Saves the next version of a text. The version is computed in the insert itself; if two staff
 * publish at once, the unique (key, locale, version) rule refuses the second (ConflictError).
 */
export async function publishContentBlock(
  em: Em,
  actor: Actor,
  input: PublishContentBlockInput,
): Promise<ContentBlockView> {
  return await em.transactional(async (tx) => {
    const rows = await sql<Row>(
      tx,
      `insert into content_blocks (id, key, locale, version, body, links, updated_by, created_at)
       select gen_random_uuid(), ?, ?, coalesce(max(version), 0) + 1, ?, ?::jsonb, ?, now()
         from content_blocks where key = ? and locale = ?
       returning ${COLUMNS}`,
      [
        input.key,
        input.locale,
        input.body,
        JSON.stringify(input.links),
        actor.userId,
        input.key,
        input.locale,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('content block insert returned no row');
    const view = toView(row);
    await emitReferenceChanged(tx, actor, 'content_block', view.id, {
      action: 'created',
      after: view,
    });
    return view;
  });
}

/** The highest version of each key for one locale. */
export async function currentContentBlocks(
  em: Em,
  locale: string,
): Promise<Record<string, ContentBlockView>> {
  const rows = await sql<Row>(
    em,
    `select distinct on (key) ${COLUMNS} from content_blocks
      where locale = ? order by key, version desc`,
    [locale],
  );
  return Object.fromEntries(rows.map((row) => [row.key, toView(row)]));
}

/** Every version for one locale, newest first within each key. */
export async function listContentBlocks(em: Em, locale: string): Promise<ContentBlockView[]> {
  const rows = await sql<Row>(
    em,
    `select ${COLUMNS} from content_blocks where locale = ? order by key, version desc`,
    [locale],
  );
  return rows.map(toView);
}
