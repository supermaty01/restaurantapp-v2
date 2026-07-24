import { verify, verifyWithJwks } from 'hono/jwt';

import type { AuthUser, Env } from './types';

/**
 * Verifies a Supabase user JWT.
 *
 * Supabase projects created from October 2025 sign tokens with **asymmetric**
 * keys (ES256/RS256) and publish the public keys at the project's JWKS
 * endpoint; verification is local and needs no shared secret. Projects that
 * still use the legacy symmetric secret (HS256) are supported as a fallback,
 * driven by whether SUPABASE_JWT_SECRET is configured.
 *
 * See docs/13 §3. Either path verifies at the edge with no call to Auth.
 */

const ASYMMETRIC_ALGORITHMS = ['RS256', 'ES256'] as const;

function jwksUri(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
}

function toUser(payload: Record<string, unknown>): AuthUser | null {
  if (typeof payload.sub !== 'string') return null;
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return email !== undefined ? { id: payload.sub, email } : { id: payload.sub };
}

export async function verifySupabaseJwt(
  authHeader: string | undefined,
  env: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_JWT_SECRET'>,
): Promise<AuthUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  // Preferred: asymmetric keys via the project's JWKS endpoint.
  if (env.SUPABASE_URL) {
    try {
      const payload = await verifyWithJwks(token, {
        jwks_uri: jwksUri(env.SUPABASE_URL),
        allowedAlgorithms: [...ASYMMETRIC_ALGORITHMS],
      });
      return toUser(payload);
    } catch {
      // Fall through: the project may still sign with the legacy secret.
    }
  }

  // Legacy: shared HS256 secret (projects predating asymmetric signing keys).
  if (env.SUPABASE_JWT_SECRET) {
    try {
      const payload = await verify(token, env.SUPABASE_JWT_SECRET, 'HS256');
      return toUser(payload);
    } catch {
      return null;
    }
  }

  return null;
}
