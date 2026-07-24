/**
 * Worker bindings + env (docs/05). Declared in wrangler.toml; secrets via
 * `wrangler secret put`. `@cloudflare/workers-types` provides R2Bucket / Ai.
 */
export interface Env {
  IMAGES: R2Bucket;
  AI: Ai;
  PUBLIC_BASE_URL: string;
  AI_GATEWAY: string;
  SUPABASE_URL: string;
  /**
   * Server-side Supabase key (`sb_secret_…`). Replaces the legacy service_role
   * key, which Supabase deprecates through 2026. Not a JWT: it travels in the
   * `apikey` header only (see shareStore).
   */
  SUPABASE_SECRET_KEY: string;
  /**
   * Legacy symmetric JWT secret. Only needed for projects created before
   * Supabase moved to asymmetric signing keys; new projects verify via JWKS.
   */
  SUPABASE_JWT_SECRET: string;
}

/** The authenticated user, attached to the request context after auth. */
export interface AuthUser {
  id: string; // Supabase auth uid
  email?: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: { user: AuthUser };
};
