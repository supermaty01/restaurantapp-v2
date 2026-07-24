import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import { verifySupabaseJwt } from '../src/auth';

const SECRET = 'test-secret';

// Legacy-secret project: no SUPABASE_URL, so JWKS is skipped and HS256 applies.
const LEGACY_ENV = { SUPABASE_URL: '', SUPABASE_JWT_SECRET: SECRET };

describe('verifySupabaseJwt — legacy HS256 projects', () => {
  it('accepts a valid token and returns the user', async () => {
    const token = await sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, LEGACY_ENV)).toEqual({
      id: 'user-1',
      email: 'a@b.com',
    });
  });

  it('rejects a missing or malformed header', async () => {
    expect(await verifySupabaseJwt(undefined, LEGACY_ENV)).toBeNull();
    expect(await verifySupabaseJwt('Basic xyz', LEGACY_ENV)).toBeNull();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await sign({ sub: 'user-1' }, 'other-secret', 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, LEGACY_ENV)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'user-1', exp: 1 }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, LEGACY_ENV)).toBeNull();
  });

  it('rejects a token without a subject', async () => {
    const token = await sign({ email: 'a@b.com' }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, LEGACY_ENV)).toBeNull();
  });
});

describe('verifySupabaseJwt — asymmetric (JWKS) projects', () => {
  // Projects created from Oct 2025 sign with ES256/RS256; the public keys come
  // from the project's JWKS endpoint. An unreachable endpoint must fail closed.
  const JWKS_ENV = { SUPABASE_URL: 'https://nonexistent.invalid', SUPABASE_JWT_SECRET: '' };

  it('rejects when the JWKS endpoint cannot validate the token', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, JWKS_ENV)).toBeNull();
  });

  it('falls back to the legacy secret when both are configured', async () => {
    // JWKS is tried first; when it fails and a legacy secret exists, an
    // HS256 token still verifies. This keeps older projects working.
    const token = await sign({ sub: 'user-1' }, SECRET, 'HS256');
    const user = await verifySupabaseJwt(`Bearer ${token}`, {
      SUPABASE_URL: 'https://nonexistent.invalid',
      SUPABASE_JWT_SECRET: SECRET,
    });
    expect(user).toEqual({ id: 'user-1' });
  });

  it('rejects everything when neither JWKS nor a secret is usable', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET, 'HS256');
    expect(
      await verifySupabaseJwt(`Bearer ${token}`, { SUPABASE_URL: '', SUPABASE_JWT_SECRET: '' }),
    ).toBeNull();
  });
});
