/** An unsigned JWT for tests: the browser only decodes tokens, it never verifies them. */
export function fakeToken(perms: string[], sub = '11111111-1111-4111-8111-111111111111'): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  return `${part({ alg: 'EdDSA' })}.${part({ sub, perms, iat: now, exp: now + 600 })}.sig`;
}

export const TEST_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Asha Admin',
  phone: '+919815099999',
  email: 'admin@hanu.property',
};
