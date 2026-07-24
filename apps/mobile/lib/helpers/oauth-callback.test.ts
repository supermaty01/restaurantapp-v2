import { extractAuthCode } from './oauth-callback';

describe('extractAuthCode', () => {
  it('reads the code from a custom-scheme redirect', () => {
    expect(extractAuthCode('restaurantapp://auth/callback?code=abc123')).toBe('abc123');
  });

  it('finds the code among other params, in any position', () => {
    expect(extractAuthCode('restaurantapp://auth/callback?state=xyz&code=abc123')).toBe('abc123');
    expect(extractAuthCode('restaurantapp://auth/callback?code=abc123&state=xyz')).toBe('abc123');
  });

  it('url-decodes the value', () => {
    expect(extractAuthCode('restaurantapp://cb?code=a%2Fb%2Bc')).toBe('a/b+c');
  });

  it('ignores params that merely end in "code"', () => {
    expect(extractAuthCode('restaurantapp://cb?authcode=nope')).toBeNull();
  });

  it('returns null when there is no code', () => {
    expect(extractAuthCode('restaurantapp://auth/callback')).toBeNull();
    expect(extractAuthCode('restaurantapp://auth/callback?error=access_denied')).toBeNull();
    expect(extractAuthCode('restaurantapp://auth/callback?code=')).toBeNull();
  });

  it('ignores a fragment (implicit-flow response carries tokens there)', () => {
    expect(extractAuthCode('restaurantapp://cb#access_token=tok&refresh_token=r')).toBeNull();
    expect(extractAuthCode('restaurantapp://cb?code=abc#access_token=tok')).toBe('abc');
  });
});
