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
  SUPABASE_JWT_SECRET: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
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
