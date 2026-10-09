export interface ServiceConfig {
  nodeEnv: string;
  logLevel: string;
  serviceName: string;
  port: number;
  databaseUrl: string;
  dbSchema: string;
  rabbitmqUrl: string;
  jwtPublicKey: string;
  platform: {
    country: string;
    currency: string;
    locale: string;
    timezone: string;
    areaBaseUnit: string;
  };
}

const REQUIRED = [
  'SERVICE_NAME',
  'PORT',
  'DATABASE_URL',
  'DB_SCHEMA',
  'RABBITMQ_URL',
  'JWT_PUBLIC_KEY',
  'PLATFORM_COUNTRY',
  'PLATFORM_CURRENCY',
  'PLATFORM_LOCALE',
  'PLATFORM_TIMEZONE',
  'PLATFORM_AREA_BASE_UNIT',
] as const;

type RequiredKey = (typeof REQUIRED)[number];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const values = new Map<RequiredKey, string>();
  const missing: string[] = [];
  for (const key of REQUIRED) {
    // eslint-disable-next-line security/detect-object-injection -- key comes from the constant list above
    const value = env[key]?.trim();
    if (value === undefined || value === '') missing.push(key);
    else values.set(key, value);
  }
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  const get = (key: RequiredKey): string => values.get(key) ?? '';

  const port = Number(get('PORT'));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    logLevel: env.LOG_LEVEL ?? 'info',
    serviceName: get('SERVICE_NAME'),
    port,
    databaseUrl: get('DATABASE_URL'),
    dbSchema: get('DB_SCHEMA'),
    rabbitmqUrl: get('RABBITMQ_URL'),
    jwtPublicKey: get('JWT_PUBLIC_KEY').replaceAll('\\n', '\n'),
    platform: {
      country: get('PLATFORM_COUNTRY'),
      currency: get('PLATFORM_CURRENCY'),
      locale: get('PLATFORM_LOCALE'),
      timezone: get('PLATFORM_TIMEZONE'),
      areaBaseUnit: get('PLATFORM_AREA_BASE_UNIT'),
    },
  };
}
