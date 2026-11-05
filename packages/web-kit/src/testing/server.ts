import { setupServer } from 'msw/node';

/** Intercepts every fetch in tests. Each test adds its handlers with `server.use(...)`. */
export const server = setupServer();
