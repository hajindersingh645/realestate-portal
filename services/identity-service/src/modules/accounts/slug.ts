/**
 * The URL part of a public profile, from the display name: lowercase ASCII words joined by
 * hyphens, at most 60 characters. A name with no Latin letters or digits gives `pro`; the
 * database then adds `-2`, `-3`… on a clash (see `createAccount`).
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'pro' : slug;
}
