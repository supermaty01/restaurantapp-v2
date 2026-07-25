import { redactUrl } from './redact';

describe('redactUrl', () => {
  it('hides the authorization code but keeps its length', () => {
    expect(redactUrl('restaurantapp://auth/callback?code=abc123')).toBe(
      'restaurantapp://auth/callback?code=<6 chars>',
    );
  });

  it('keeps the parts that matter for debugging', () => {
    // The error is the whole point of reading the log.
    expect(
      redactUrl('restaurantapp://auth/callback?error=server_error&error_description=nope'),
    ).toBe('restaurantapp://auth/callback?error=server_error&error_description=nope');
  });

  it('redacts tokens carried in the fragment', () => {
    expect(redactUrl('restaurantapp://cb#access_token=aaaa&refresh_token=bb&expires_in=3600')).toBe(
      'restaurantapp://cb#access_token=<4 chars>&refresh_token=<2 chars>&expires_in=3600',
    );
  });

  it('redacts every secret parameter it knows about', () => {
    const url =
      'https://x.supabase.co/authorize?provider=google&code_challenge=xyz&apikey=secret&state=ok';
    const result = redactUrl(url);

    expect(result).toContain('provider=google');
    expect(result).toContain('state=ok');
    expect(result).not.toContain('xyz');
    expect(result).not.toContain('secret');
  });

  it('shows an empty secret as empty, which is usually the bug', () => {
    expect(redactUrl('restaurantapp://cb?code=')).toBe('restaurantapp://cb?code=<0 chars>');
  });

  it('leaves a URL with no query alone', () => {
    expect(redactUrl('restaurantapp://auth/callback')).toBe('restaurantapp://auth/callback');
  });
});
