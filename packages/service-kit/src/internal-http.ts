import { AppError } from './errors.js';

/** Another service did not answer in time or answered with an error. */
export class UpstreamError extends AppError {
  constructor(message = 'A required service is unavailable') {
    super('UPSTREAM_UNAVAILABLE', message, 503);
  }
}

/**
 * "Ask" another service: GET `/internal/*` with a timeout. Reads need no idempotency key;
 * a later internal write helper adds one.
 */
export async function internalGet<T>(
  baseUrl: string,
  path: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2000),
    });
  } catch {
    throw new UpstreamError();
  }
  if (!response.ok) throw new UpstreamError();
  return (await response.json()) as T;
}
