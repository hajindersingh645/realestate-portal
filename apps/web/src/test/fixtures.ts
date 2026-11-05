import { useSession } from '@hanu/web-kit';
import { fakeToken, http, HttpResponse, server, TEST_USER } from '@hanu/web-kit/testing';
import type { MyAccount } from '../professional/account-api';
import type { MyRequirement } from '../requirements/requirements-api';

export const MOHALI = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c01';
export const SECTOR_70 = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c02';
export const FLAT = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c04';
export const REQ_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c05';
export const NOTICE_ID = '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c09';

const location = (id: string, type: string, parentId: string | null, name: string) => ({
  id,
  type,
  parentId,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  code: null,
  lat: null,
  lng: null,
  isActive: true,
  sort: 0,
});

export const REFERENCE = {
  platform: {
    country: 'IN',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    areaBaseUnit: 'sqft',
  },
  locations: [
    location('7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c00', 'state', null, 'Punjab'),
    location(MOHALI, 'city', '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c00', 'Mohali'),
    location(SECTOR_70, 'locality', MOHALI, 'Sector 70'),
  ],
  propertyTypes: [
    { id: FLAT, parentId: null, slug: 'flat', name: 'Flat', kind: 'flat', isActive: true, sort: 0 },
  ],
  lookups: [
    {
      id: 'l1',
      group: 'timeline',
      code: 'within_3_months',
      label: 'Within 3 months',
      meta: null,
      isActive: true,
      sort: 0,
    },
  ],
  unitConversions: [],
  notices: {
    'signup.data_notice': {
      id: NOTICE_ID,
      version: 1,
      body: 'We use your phone number to sign you in.',
      links: [{ label: 'Privacy policy', url: '/privacy' }],
    },
  },
};

export function account(overrides: Partial<MyAccount> = {}): MyAccount {
  return {
    id: '7f1f7f0e-7d5c-4a3e-9b1e-2a8f5a1f6c03',
    type: 'agent',
    displayName: 'Ravi Realty',
    slug: 'ravi-realty',
    about: null,
    experienceYears: 8,
    specialisations: ['Plots'],
    licenseNumber: null,
    status: 'pending',
    areas: [{ locationId: SECTOR_70, cityId: MOHALI }],
    rejectReason: null,
    license: { label: 'RERA', mandatory: false },
    ...overrides,
  };
}

/** Signs in with `perms` and answers `/users/me` and `/catalog/reference`. */
export function signedIn(perms: string[], registeredAs: 'buyer' | 'professional' | 'staff') {
  useSession.getState().signIn({ accessToken: fakeToken(perms), user: TEST_USER });
  server.use(
    http.get('/api/v1/users/me', () =>
      HttpResponse.json({ ...TEST_USER, email: null, registeredAs, permissions: perms }),
    ),
    http.get('/api/v1/catalog/reference', () => HttpResponse.json(REFERENCE)),
  );
}

export const NO_ACCOUNT = () =>
  HttpResponse.json(
    { error: { code: 'NOT_FOUND', message: 'No professional account yet' } },
    { status: 404 },
  );

export function requirement(overrides: Partial<MyRequirement> = {}): MyRequirement {
  return {
    id: REQ_ID,
    status: 'live',
    purpose: 'buy',
    propertyTypeId: FLAT,
    areas: [{ locationId: SECTOR_70, cityId: MOHALI }],
    budgetMin: '6000000000',
    budgetMax: '8500000000',
    bedrooms: [3],
    areaMin: null,
    areaMax: null,
    areaUnit: null,
    possession: null,
    timeline: 'within_3_months',
    loanNeeded: true,
    preferences: {},
    notes: 'Near a school',
    unlockCount: 1,
    maxUnlocks: 5,
    publishedAt: '2026-11-05T10:00:00.000Z',
    expiresAt: '2027-01-04T10:00:00.000Z',
    rejectReason: null,
    createdAt: '2026-11-05T09:00:00.000Z',
    ...overrides,
  };
}
