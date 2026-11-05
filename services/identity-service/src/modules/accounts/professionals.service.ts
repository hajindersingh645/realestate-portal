import type { AccountType } from '@hanu/contracts';
import { decodeCursor, encodeCursor, NotFoundError, sql, type Em } from '@hanu/service-kit';
import type { Area } from './accounts.service.js';

/** What the public site may show. No owner name, phone or email. */
export interface PublicProfessional {
  id: string;
  slug: string;
  type: AccountType;
  displayName: string;
  about: string | null;
  experienceYears: number | null;
  specialisations: string[];
  licenseNumber: string | null;
  areas: Area[];
}

export interface ProfessionalFilter {
  cityId?: string;
  locationId?: string;
  type?: AccountType;
  cursor?: string;
}

const PAGE = 50;
/** The one rule that keeps unapproved accounts off the public site. Every query here uses it. */
const LIVE = `a.status = 'approved' and a.deleted_at is null`;
const COLUMNS = `a.id, a.slug, a.type, a.display_name as "displayName", a.about,
  a.experience_years as "experienceYears", a.specialisations, a.license_number as "licenseNumber",
  coalesce((select json_agg(json_build_object('locationId', l.location_id, 'cityId', l.city_id)
                            order by l.location_id)
              from account_locations l where l.account_id = a.id), '[]') as areas`;

export async function getProfessional(em: Em, slug: string): Promise<PublicProfessional> {
  const rows = await sql<PublicProfessional>(
    em,
    `select ${COLUMNS} from accounts a where a.slug = ? and ${LIVE}`,
    [slug],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError('Professional not found');
  return row;
}

/** Newest first, 50 per page. A locality filter matches accounts that listed that locality. */
export async function listProfessionals(
  em: Em,
  filter: ProfessionalFilter,
): Promise<{ data: PublicProfessional[]; nextCursor: string | null }> {
  const [at, id] = filter.cursor === undefined ? [null, null] : decodeCursor(filter.cursor);
  const rows = await sql<PublicProfessional & { cursorAt: string }>(
    em,
    `select ${COLUMNS},
            to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorAt"
       from accounts a
      where ${LIVE}
        and (?::text is null or a.type = ?)
        and (?::uuid is null or exists (select 1 from account_locations l
                                         where l.account_id = a.id and l.city_id = ?::uuid))
        and (?::uuid is null or exists (select 1 from account_locations l
                                         where l.account_id = a.id and l.location_id = ?::uuid))
        and (?::timestamptz is null or (a.created_at, a.id) < (?::timestamptz, ?::uuid))
      order by a.created_at desc, a.id desc
      limit ${String(PAGE + 1)}`,
    [
      filter.type ?? null,
      filter.type ?? null,
      filter.cityId ?? null,
      filter.cityId ?? null,
      filter.locationId ?? null,
      filter.locationId ?? null,
      at,
      at,
      id,
    ],
  );
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);
  return {
    data: page, // `cursorAt` is dropped by the route's response schema
    nextCursor:
      rows.length > PAGE && last !== undefined ? encodeCursor(last.cursorAt, last.id) : null,
  };
}
