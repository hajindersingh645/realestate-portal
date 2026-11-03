import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { useSession } from '../session/session-store';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  useSession.setState({ accessToken: null, user: null, perms: [], status: 'signed-out' });
});
afterAll(() => {
  server.close();
});
