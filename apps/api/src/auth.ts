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

/**
 * Las claves públicas, en memoria.
 *
 * `verifyWithJwks` con `jwks_uri` **va a la red en cada llamada**: una petición
 * HTTP extra por cada petición autenticada de la app. Eso es latencia añadida a
 * todo, cuota gastada, y una dependencia dura — si el endpoint de Supabase
 * tarda, tarda toda la API.
 *
 * Las claves de firma de un proyecto cambian como mucho en una rotación, así que
 * una hora de caché es conservadora. La instancia del Worker vive lo que vive,
 * de modo que esto es un acierto de caché por instancia caliente y nada más:
 * ninguna clave se queda pegada más de `TTL`.
 */
const JWKS_TTL_MS = 60 * 60 * 1000;

interface CachedJwks {
  keys: JsonWebKey[];
  fetchedAt: number;
}

let jwksCache: CachedJwks | null = null;

async function fetchJwks(uri: string): Promise<JsonWebKey[] | null> {
  const fresh = jwksCache !== null && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && jwksCache !== null) return jwksCache.keys;

  try {
    const response = await fetch(uri);
    if (!response.ok) return jwksCache?.keys ?? null;

    const payload = await response.json<{ keys?: JsonWebKey[] }>();
    if (!Array.isArray(payload.keys)) return jwksCache?.keys ?? null;

    jwksCache = { keys: payload.keys, fetchedAt: Date.now() };
    return payload.keys;
  } catch {
    // Un fallo puntual de red no invalida lo que ya se sabe: seguir con las
    // claves viejas es preferible a rechazar a todo el mundo. Si de verdad
    // rotaron, la firma no valida y el token cae por su propio peso.
    return jwksCache?.keys ?? null;
  }
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
    const keys = await fetchJwks(jwksUri(env.SUPABASE_URL));
    if (keys !== null) {
      try {
        // `keys` y no `jwks_uri`: con la uri, hono va a la red en cada llamada.
        const payload = await verifyWithJwks(token, {
          keys,
          allowedAlgorithms: [...ASYMMETRIC_ALGORITHMS],
        });
        return toUser(payload);
      } catch {
        // Fall through: the project may still sign with the legacy secret.
      }
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
