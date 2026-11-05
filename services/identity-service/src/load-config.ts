import { loadConfig, type ServiceConfig } from '@hanu/service-kit';

export interface IdentityConfig extends ServiceConfig {
  /** Signs access tokens. Only identity-service holds it. */
  jwtPrivateKey: string;
  /** HMAC key for OTP codes; a bare hash of six digits is reversed in milliseconds. */
  otpSecret: string;
}

export function loadIdentityConfig(env: NodeJS.ProcessEnv): IdentityConfig {
  const base = loadConfig(env);
  const jwtPrivateKey = env.JWT_PRIVATE_KEY?.trim() ?? '';
  const otpSecret = env.OTP_SECRET?.trim() ?? '';
  if (jwtPrivateKey === '') throw new Error('Missing environment variables: JWT_PRIVATE_KEY');
  if (otpSecret.length < 32) throw new Error('OTP_SECRET must be at least 32 characters');
  return { ...base, jwtPrivateKey: jwtPrivateKey.replaceAll('\\n', '\n'), otpSecret };
}
