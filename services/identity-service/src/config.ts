import { loadIdentityConfig, type IdentityConfig } from './load-config.js';

export const config: IdentityConfig = loadIdentityConfig(process.env);
