/**
 * Reads the PKCE authorization `code` out of an OAuth redirect URL.
 *
 * The redirect uses a custom scheme (`restaurantapp://auth/callback?code=…`),
 * and React Native's `URL` handles those inconsistently — it can throw or drop
 * the query. Parsing the query string directly is both reliable and testable.
 * Returns null when there is no code (user cancelled, provider error, or an
 * implicit-flow response carrying tokens in the fragment instead).
 */
export function extractAuthCode(redirectUrl: string): string | null {
  const queryStart = redirectUrl.indexOf('?');
  if (queryStart === -1) return null;

  // Drop any fragment: it is not part of the query.
  const fragmentStart = redirectUrl.indexOf('#', queryStart);
  const query =
    fragmentStart === -1
      ? redirectUrl.slice(queryStart + 1)
      : redirectUrl.slice(queryStart + 1, fragmentStart);

  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== 'code') continue;

    const value = decodeURIComponent(pair.slice(separator + 1));
    return value.length > 0 ? value : null;
  }

  return null;
}
