import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { fakeToken, TEST_USER } from '../test/tokens';
import { useSession } from './session-store';
import { useCan } from './useCan';

test('signIn, with a token whose perms are [admin.catalog.manage], makes useCan(admin.catalog.manage) true and useCan(admin.access.manage) false', () => {
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.catalog.manage']), user: TEST_USER });

  const catalog = renderHook(() => useCan('admin.catalog.manage'));
  const access = renderHook(() => useCan('admin.access.manage'));

  expect(catalog.result.current).toBe(true);
  expect(access.result.current).toBe(false);
});

test('signOut, after signIn, clears the token, user and permissions', () => {
  useSession
    .getState()
    .signIn({ accessToken: fakeToken(['admin.catalog.manage']), user: TEST_USER });

  useSession.getState().signOut();

  expect(useSession.getState()).toMatchObject({
    accessToken: null,
    user: null,
    perms: [],
    status: 'signed-out',
  });
});
