import { loadConfig, type ServiceConfig } from '@hanu/service-kit';

export interface LeadConfig extends ServiceConfig {
  /** identity-service inside the network, for `/internal/*` (buyer contact, account names). */
  identityInternalUrl: string;
  /** catalog-service inside the network, for `/internal/*` (locations, property types). */
  catalogInternalUrl: string;
}

function requiredUrl(env: NodeJS.ProcessEnv, name: string): string {
  // eslint-disable-next-line security/detect-object-injection -- fixed names from this file
  const value = env[name]?.trim().replace(/\/+$/, '') ?? '';
  if (value === '') throw new Error(`Missing environment variables: ${name}`);
  return value;
}

export function loadLeadConfig(env: NodeJS.ProcessEnv): LeadConfig {
  return {
    ...loadConfig(env),
    identityInternalUrl: requiredUrl(env, 'IDENTITY_INTERNAL_URL'),
    catalogInternalUrl: requiredUrl(env, 'CATALOG_INTERNAL_URL'),
  };
}
