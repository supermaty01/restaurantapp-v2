import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import app from '../src/index';

import type { Env } from '../src/types';

/**
 * Auth boundary tests. This is the security-critical seam: everything except an
 * explicit allowlist must require a valid Supabase JWT.
 */
const SECRET = 'test-secret';
const ENV = {
  SUPABASE_JWT_SECRET: SECRET,
  PUBLIC_BASE_URL: 'https://x.app',
  SUPABASE_URL: 'https://supabase.invalid',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as unknown as Env;

function req(path: string, init: RequestInit = {}) {
  return app.request(path, init, ENV);
}

describe('worker auth boundary', () => {
  it('serves /health without a token', async () => {
    const res = await req('/health');
    expect(res.status).toBe(200);
  });

  it('rejects protected routes without a token', async () => {
    for (const [path, method] of [
      ['/share', 'POST'],
      ['/ai/chat', 'POST'],
      ['/ai/embed', 'POST'],
      ['/ai/transcribe', 'POST'],
      ['/images/abc', 'PUT'],
      ['/images/abc', 'DELETE'],
    ] as const) {
      const res = await req(path, { method });
      expect(`${method} ${path} → ${res.status}`).toBe(`${method} ${path} → 401`);
    }
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await sign({ sub: 'user-1' }, 'wrong-secret', 'HS256');
    const res = await req('/share', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('lets a valid token past the auth boundary', async () => {
    const token = await sign({ sub: 'user-1' }, SECRET, 'HS256');
    // Malformed body ⇒ 400 from the route, which proves auth was passed.
    const res = await req('/share', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('keeps public share/image reads open (no 401)', async () => {
    // These hit the store/R2 and fail for other reasons, but must not be 401.
    for (const path of ['/s/abc123', '/share/abc123/data', '/images/user-1/img-1']) {
      const res = await req(path);
      expect(`${path} → ${res.status}`).not.toBe(`${path} → 401`);
    }
  });

  it('does not treat non-GET requests to public-shaped paths as public', async () => {
    // The allowlist must be method-aware: a write to a public-looking path is
    // still a write and must require auth.
    for (const [path, method] of [
      ['/images/user-1/img-1', 'DELETE'],
      ['/images/user-1/img-1', 'PUT'],
      ['/share/abc123/data', 'DELETE'],
    ] as const) {
      const res = await req(path, { method });
      expect(`${method} ${path} → ${res.status}`).toBe(`${method} ${path} → 401`);
    }
  });
});
