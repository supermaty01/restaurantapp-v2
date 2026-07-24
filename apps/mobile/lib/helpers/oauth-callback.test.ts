import { parseOAuthCallback } from './oauth-callback';

describe('parseOAuthCallback', () => {
  describe('PKCE code', () => {
    it('reads the code from a custom-scheme redirect', () => {
      expect(parseOAuthCallback('restaurantapp://auth/callback?code=abc123')).toEqual({
        type: 'code',
        code: 'abc123',
      });
    });

    it('finds the code among other params, in any position', () => {
      expect(parseOAuthCallback('restaurantapp://cb?state=xyz&code=abc123')).toMatchObject({
        code: 'abc123',
      });
      expect(parseOAuthCallback('restaurantapp://cb?code=abc123&state=xyz')).toMatchObject({
        code: 'abc123',
      });
    });

    it('url-decodes the value', () => {
      expect(parseOAuthCallback('restaurantapp://cb?code=a%2Fb%2Bc')).toMatchObject({
        code: 'a/b+c',
      });
    });

    it('ignores params that merely end in "code"', () => {
      expect(parseOAuthCallback('restaurantapp://cb?authcode=nope').type).toBe('unrecognised');
    });

    it('treats an empty code as absent', () => {
      expect(parseOAuthCallback('restaurantapp://cb?code=').type).toBe('unrecognised');
    });
  });

  describe('implicit-flow tokens', () => {
    // Supabase answers this way in some configurations. The first version
    // deliberately ignored the fragment and so failed a login that could work.
    it('accepts tokens carried in the fragment', () => {
      expect(parseOAuthCallback('restaurantapp://cb#access_token=tok&refresh_token=ref')).toEqual({
        type: 'session',
        accessToken: 'tok',
        refreshToken: 'ref',
      });
    });

    it('needs both tokens to build a session', () => {
      expect(parseOAuthCallback('restaurantapp://cb#access_token=tok').type).toBe('unrecognised');
    });

    it('prefers a PKCE code over fragment tokens', () => {
      expect(parseOAuthCallback('restaurantapp://cb?code=abc#access_token=tok')).toMatchObject({
        type: 'code',
        code: 'abc',
      });
    });
  });

  describe('provider errors', () => {
    it('surfaces the description when there is one', () => {
      const result = parseOAuthCallback(
        'restaurantapp://cb?error=server_error&error_description=Database+error+saving+new+user',
      );
      expect(result).toEqual({ type: 'error', message: 'Database error saving new user' });
    });

    it('reads errors out of the fragment too', () => {
      expect(parseOAuthCallback('restaurantapp://cb#error=access_denied')).toEqual({
        type: 'error',
        message: 'access_denied',
      });
    });

    it('reports an error even when a stale code rides along', () => {
      expect(parseOAuthCallback('restaurantapp://cb?code=abc&error=access_denied').type).toBe(
        'error',
      );
    });
  });

  describe('nothing usable', () => {
    it('lists what did come back, so the shape is debuggable', () => {
      expect(parseOAuthCallback('restaurantapp://cb?state=xyz&foo=1')).toEqual({
        type: 'unrecognised',
        params: ['foo', 'state'],
      });
    });

    it('handles a redirect with no params at all', () => {
      expect(parseOAuthCallback('restaurantapp://auth/callback')).toEqual({
        type: 'unrecognised',
        params: [],
      });
    });
  });
});
