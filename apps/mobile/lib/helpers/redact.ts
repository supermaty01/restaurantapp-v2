/** Query parameters whose values must never reach a log. */
const SECRET_PARAMS = new Set([
  'code',
  'access_token',
  'refresh_token',
  'id_token',
  'provider_token',
  'provider_refresh_token',
  'code_challenge',
  'client_secret',
  'apikey',
]);

/** Replaces secret values in an `a=1&b=2` string with their length. */
function redactParams(source: string): string {
  return source
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=');
      if (separator === -1) return pair;

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      return SECRET_PARAMS.has(key) ? `${key}=<${value.length} chars>` : pair;
    })
    .join('&');
}

/**
 * A URL you can paste into a bug report.
 *
 * Auth debugging needs the *shape* of a redirect — which parameters came back,
 * in which order, with what error — and none of the values that would let
 * someone log in as you. Secrets are replaced by their length, which is often
 * the clue anyway: an empty code and a 200-character one fail very differently.
 *
 * The fragment is split off first. Doing the query first missed URLs that carry
 * everything after a `#` and no `?` at all — which is exactly the implicit-flow
 * response, the one case where the tokens themselves are in the URL.
 */
export function redactUrl(url: string): string {
  const hash = url.indexOf('#');
  const beforeFragment = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? null : url.slice(hash + 1);

  const question = beforeFragment.indexOf('?');
  const base = question === -1 ? beforeFragment : beforeFragment.slice(0, question);
  const query = question === -1 ? null : beforeFragment.slice(question + 1);

  const safeQuery = query === null ? '' : `?${redactParams(query)}`;
  const safeFragment = fragment === null ? '' : `#${redactParams(fragment)}`;

  return `${base}${safeQuery}${safeFragment}`;
}
