/**
 * Interprets the deep link an OAuth provider redirects back to.
 *
 * There are three shapes the redirect can take and the login only works if all
 * three are handled:
 *
 * - **PKCE** puts an authorization `code` in the query, to be exchanged for a
 *   session. This is what the app asks for (`flowType: 'pkce'`).
 * - **Implicit** puts `access_token`/`refresh_token` in the *fragment*. Supabase
 *   still answers this way in some configurations, so accepting it turns a hard
 *   failure into a working login instead.
 * - **Failure** puts `error`/`error_description` in either place — Supabase has
 *   historically used the fragment for these.
 *
 * The first version only looked for `code` in the query and returned null for
 * everything else, which collapsed all three failure modes into one useless
 * "oauth-code-missing". Parsing both parts and naming the outcome is what makes
 * a broken login diagnosable.
 *
 * Custom schemes (`restaurantapp://auth/callback?…`) are parsed by hand because
 * React Native's `URL` handles non-http schemes inconsistently: it can throw or
 * silently drop the query.
 */

export type OAuthCallback =
  | { type: 'code'; code: string }
  | { type: 'session'; accessToken: string; refreshToken: string }
  | { type: 'error'; message: string }
  | { type: 'unrecognised'; params: string[] };

/** Splits `a=1&b=2` into a map, url-decoding both sides. */
function parseParams(source: string, into: Map<string, string>): void {
  for (const pair of source.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    const key = decodeURIComponent(pair.slice(0, separator));
    const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '));
    // Query wins over fragment: a PKCE code is more specific than leftovers.
    if (value.length > 0 && !into.has(key)) into.set(key, value);
  }
}

/** Collects params from the query string *and* the fragment into one map. */
function collectParams(redirectUrl: string): Map<string, string> {
  const params = new Map<string, string>();

  const fragmentStart = redirectUrl.indexOf('#');
  const beforeFragment =
    fragmentStart === -1 ? redirectUrl : redirectUrl.slice(0, fragmentStart);

  const queryStart = beforeFragment.indexOf('?');
  if (queryStart !== -1) parseParams(beforeFragment.slice(queryStart + 1), params);

  if (fragmentStart !== -1) parseParams(redirectUrl.slice(fragmentStart + 1), params);

  return params;
}

export function parseOAuthCallback(redirectUrl: string): OAuthCallback {
  const params = collectParams(redirectUrl);

  // Errors first: a redirect can carry both an error and stale state.
  const errorDescription = params.get('error_description');
  const errorCode = params.get('error') ?? params.get('error_code');
  if (errorDescription || errorCode) {
    return {
      type: 'error',
      message: errorDescription ?? (errorCode as string),
    };
  }

  const code = params.get('code');
  if (code) return { type: 'code', code };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { type: 'session', accessToken, refreshToken };
  }

  // Name what *did* come back, so an unexpected shape is debuggable instead of
  // silent.
  return { type: 'unrecognised', params: [...params.keys()].sort() };
}
