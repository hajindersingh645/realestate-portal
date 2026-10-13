export interface GatewayConfig {
  port: number;
  logLevel: string;
  corsOrigins: string[];
  rateLimitMax: number;
  routes: { prefix: string; upstream: string }[];
}

// One line per service. Add a row when a service is added.
const ROUTE_ENV: { prefix: string; env: string }[] = [
  { prefix: '/api/v1/catalog', env: 'CATALOG_URL' },
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
  const routes = ROUTE_ENV.map((route) => ({ prefix: route.prefix, upstream: read(route.env) }));

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer');
  if (!Number.isInteger(rateLimitMax) || rateLimitMax <= 0) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer');
  }

  return { port, logLevel: env.LOG_LEVEL ?? 'info', corsOrigins, rateLimitMax, routes };
}
