import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import { verifySupabaseJwt } from '../src/auth';

const SECRET = 'test-secret';

describe('verifySupabaseJwt', () => {
  it('accepts a valid token and returns the user', async () => {
    const token = await sign({ sub: 'user-1', email: 'a@b.com' }, SECRET, 'HS256');
    const user = await verifySupabaseJwt(`Bearer ${token}`, SECRET);
    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });

  it('rejects a missing or malformed header', async () => {
    expect(await verifySupabaseJwt(undefined, SECRET)).toBeNull();
    expect(await verifySupabaseJwt('Basic xyz', SECRET)).toBeNull();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await sign({ sub: 'user-1' }, 'other-secret', 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'user-1', exp: 1 }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, SECRET)).toBeNull();
  });

  it('rejects a token without a subject', async () => {
    const token = await sign({ email: 'a@b.com' }, SECRET, 'HS256');
    expect(await verifySupabaseJwt(`Bearer ${token}`, SECRET)).toBeNull();
  });
});
