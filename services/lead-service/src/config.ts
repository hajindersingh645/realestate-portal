import { loadLeadConfig, type LeadConfig } from './load-config.js';

export const config: LeadConfig = loadLeadConfig(process.env);
