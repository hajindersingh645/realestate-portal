/** An error answer from the API, in the services' `{ error: { code, message } }` shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field name → message, parsed from validation messages such as `body/name must …`. */
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = code === 'VALIDATION' ? parseFields(message) : {};
  }
}

function parseFields(message: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of message.split(/,\s*(?=body\/)/)) {
    const match = /^body\/(\w+)\s+(.+)$/.exec(part.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) fields[match[1]] = match[2];
  }
  return fields;
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new ApiError(
    response.status,
    typeof error?.code === 'string' ? error.code : 'UNKNOWN',
    typeof error?.message === 'string' ? error.message : 'Something went wrong. Try again.',
  );
}
