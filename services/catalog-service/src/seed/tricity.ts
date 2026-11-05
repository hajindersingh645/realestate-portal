/** Launch master data for the Chandigarh Tricity. Loaded by `run-seed.ts`; safe to load repeatedly. */

export interface SeedLocality {
  name: string;
  slug: string;
}

export interface SeedCity {
  name: string;
  slug: string;
  sort: number;
  /** Starter set only. The full list is added through the admin routes. */
  localities: SeedLocality[];
}

export interface SeedState {
  name: string;
  slug: string;
  code: string;
  cities: SeedCity[];
}

export interface SeedPropertyType {
  slug: string;
  name: string;
  kind: 'flat' | 'house' | 'plot' | 'commercial';
  sort: number;
  parent?: string;
}

export interface SeedLookup {
  group: string;
  code: string;
  label: string;
  sort: number;
}

export interface SeedConversion {
  /** `code` of a lookup in the `area_unit` group. */
  unit: string;
  /** Base unit is sq ft (PLATFORM_AREA_BASE_UNIT). */
  factor: number;
}

function numbered(group: string, items: [code: string, label: string][]): SeedLookup[] {
  return items.map(([code, label], index) => ({ group, code, label, sort: index + 1 }));
}

export const TRICITY_SEED = {
  states: [
    {
      name: 'Chandigarh',
      slug: 'chandigarh-ut',
      code: 'CH',
      cities: [
        {
          name: 'Chandigarh',
          slug: 'chandigarh',
          sort: 1,
          localities: [
            { name: 'Sector 17', slug: 'sector-17' },
            { name: 'Sector 35', slug: 'sector-35' },
          ],
        },
      ],
    },
    {
      name: 'Punjab',
      slug: 'punjab',
      code: 'PB',
      cities: [
        {
          name: 'Mohali',
          slug: 'mohali',
          sort: 2,
          localities: [
            { name: 'Sector 70', slug: 'sector-70' },
            { name: 'Aerocity', slug: 'aerocity' },
          ],
        },
        {
          name: 'Zirakpur',
          slug: 'zirakpur',
          sort: 4,
          localities: [
            { name: 'VIP Road', slug: 'vip-road' },
            { name: 'Patiala Road', slug: 'patiala-road' },
          ],
        },
        {
          name: 'Kharar',
          slug: 'kharar',
          sort: 5,
          localities: [{ name: 'Sunny Enclave', slug: 'sunny-enclave' }],
        },
        { name: 'Dera Bassi', slug: 'dera-bassi', sort: 6, localities: [] },
      ],
    },
    {
      name: 'Haryana',
      slug: 'haryana',
      code: 'HR',
      cities: [
        {
          name: 'Panchkula',
          slug: 'panchkula',
          sort: 3,
          localities: [
            { name: 'Sector 20', slug: 'sector-20' },
            { name: 'Sector 5', slug: 'sector-5' },
          ],
        },
      ],
    },
  ] satisfies SeedState[],

  propertyTypes: [
    { slug: 'flat', name: 'Flat', kind: 'flat', sort: 1 },
    { slug: 'independent-floor', name: 'Independent floor', kind: 'flat', sort: 2 },
    { slug: 'house', name: 'House / Kothi', kind: 'house', sort: 3 },
    { slug: 'plot', name: 'Plot', kind: 'plot', sort: 4 },
    { slug: 'commercial', name: 'Commercial', kind: 'commercial', sort: 5 },
    { slug: 'shop', name: 'Shop', kind: 'commercial', sort: 1, parent: 'commercial' },
    { slug: 'office', name: 'Office', kind: 'commercial', sort: 2, parent: 'commercial' },
    { slug: 'sco', name: 'SCO', kind: 'commercial', sort: 3, parent: 'commercial' },
  ] satisfies SeedPropertyType[],

  lookups: [
    ...numbered('bhk', [
      ['1_bhk', '1 BHK'],
      ['2_bhk', '2 BHK'],
      ['3_bhk', '3 BHK'],
      ['4_bhk', '4 BHK'],
      ['5_bhk_plus', '5+ BHK'],
    ]),
    ...numbered('building_type', [
      ['high_rise', 'High-rise'],
      ['s_plus_3', 'S+3'],
      ['s_plus_4', 'S+4'],
    ]),
    ...numbered('plot_size', [
      ['100_sq_yd', '100 sq yd'],
      ['150_sq_yd', '150 sq yd'],
      ['200_sq_yd', '200 sq yd'],
      ['250_sq_yd', '250 sq yd'],
      ['500_sq_yd', '500 sq yd'],
    ]),
    ...numbered('furnishing', [
      ['unfurnished', 'Unfurnished'],
      ['semi_furnished', 'Semi-furnished'],
      ['fully_furnished', 'Fully furnished'],
    ]),
    ...numbered('facing', [
      ['north', 'North'],
      ['east', 'East'],
      ['south', 'South'],
      ['west', 'West'],
      ['north_east', 'North-East'],
      ['north_west', 'North-West'],
      ['south_east', 'South-East'],
      ['south_west', 'South-West'],
    ]),
    ...numbered('possession', [
      ['ready_to_move', 'Ready to move'],
      ['under_construction', 'Under construction'],
      ['any', 'Any'],
    ]),
    ...numbered('timeline', [
      ['immediately', 'Immediately'],
      ['within_3_months', 'Within 3 months'],
      ['3_6_months', '3–6 months'],
      ['6_plus_months', '6+ months'],
    ]),
    ...numbered('area_unit', [
      ['sqft', 'sq ft'],
      ['sq_yd', 'sq yd'],
      ['marla', 'Marla'],
      ['kanal', 'Kanal'],
    ]),
    ...numbered('amenity', [
      ['lift', 'Lift'],
      ['parking', 'Parking'],
      ['power_backup', 'Power backup'],
      ['security', '24×7 security'],
      ['park', 'Park'],
      ['gym', 'Gym'],
      ['club_house', 'Club house'],
    ]),
  ] satisfies SeedLookup[],

  /** Defaults. Tricity convention: 1 marla = 25 sq yd, 1 kanal = 500 sq yd (decision D1). */
  unitConversions: [
    { unit: 'sqft', factor: 1 },
    { unit: 'sq_yd', factor: 9 },
    { unit: 'marla', factor: 225 },
    { unit: 'kanal', factor: 4500 },
  ] satisfies SeedConversion[],
  /** Placeholder until the owner writes the real text (Admin → Content). */
  dataNotice: {
    body: 'We use your name and phone number to create your account, verify you and show your details to the people you choose to deal with on Hanu.property. Read how we handle your data before you continue.',
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms', url: '/terms' },
    ],
  },
};
