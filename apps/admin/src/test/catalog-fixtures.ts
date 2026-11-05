export const MOHALI = '33333333-3333-4333-8333-333333333301';
export const PUNJAB = '33333333-3333-4333-8333-333333333300';

export function location(
  over: Partial<Record<string, unknown>> & { id: string; name: string; type: string },
) {
  return {
    parentId: null,
    slug: over.name.toLowerCase().replace(/\s+/g, '-'),
    code: null,
    lat: null,
    lng: null,
    isActive: true,
    sort: 0,
    ...over,
  };
}
