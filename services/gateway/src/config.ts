export interface GatewayConfig {
  port: number;
  logLevel: string;
  corsOrigins: string[];
  rateLimitMax: number;
  /** `rewritePrefix`: what the upstream sees instead of `prefix` (default: nothing, prefix removed). */
  routes: { prefix: string; upstream: string; rewritePrefix: string }[];
}

// One line per prefix. Add a row when a service is added. A service that owns several prefixes
// keeps them (rewritePrefix) so its own routes do not collide.
const ROUTE_ENV: { prefix: string; env: string; rewritePrefix?: string }[] = [
  { prefix: '/api/v1/catalog', env: 'CATALOG_URL' },
  { prefix: '/api/v1/auth', env: 'IDENTITY_URL', rewritePrefix: '/auth' },
  { prefix: '/api/v1/users', env: 'IDENTITY_URL', rewritePrefix: '/users' },
  { prefix: '/api/v1/admin/identity', env: 'IDENTITY_URL', rewritePrefix: '/admin/identity' },
];

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const missing: string[] = [];
  const read = (key: string): string => {
    // eslint-disable-next-line security/detect-object-injection -- keys are constants in this file
    const value = env[key]?.trim();
    if (value === undefined || value === '') missing.push(key);
    return value ?? '';
  };

  const port = Number(read('PORT'));
  const rateLimitMax = Number(read('RATE_LIMIT_MAX'));
  const corsOrigins = read('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  const routes = ROUTE_ENV.map((route) => ({
    prefix: route.prefix,
    upstream: read(route.env),
    rewritePrefix: route.rewritePrefix ?? '',
  }));

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer');
  if (!Number.isInteger(rateLimitMax) || rateLimitMax <= 0) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer');
  }

  return { port, logLevel: env.LOG_LEVEL ?? 'info', corsOrigins, rateLimitMax, routes };
}
