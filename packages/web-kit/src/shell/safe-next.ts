/** Where to go after sign-in: only a path inside this app, never `//host` or an absolute URL. */
export function safeNext(raw: string | null, home = '/'): string {
  if (raw === null || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\'))
    return home;
  return raw;
}
