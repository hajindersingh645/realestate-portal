import { PATHS } from '../paths';

/** Where to go after sign-in: only a path inside this app, never `//host` or an absolute URL. */
export function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\'))
    return PATHS.home;
  return raw;
}
