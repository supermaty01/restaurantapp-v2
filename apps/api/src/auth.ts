import { verify } from 'hono/jwt';

import type { AuthUser } from './types';

/**
 * Verifies a Supabase user JWT (HS256, signed with the project's JWT secret).
 * Returns the user, or null if the token is missing/invalid/expired.
 *
 * This runs at the edge with no network call — the secret is enough to verify.
 */
export async function verifySupabaseJwt(
  authHeader: string | undefined,
  jwtSecret: string,
): Promise<AuthUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = await verify(token, jwtSecret, 'HS256');
    if (typeof payload.sub !== 'string') return null;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return email !== undefined ? { id: payload.sub, email } : { id: payload.sub };
  } catch {
    return null;
  }
}
