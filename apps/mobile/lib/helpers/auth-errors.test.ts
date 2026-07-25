import { describeAuthError } from './auth-errors';

describe('describeAuthError', () => {
  it('explains an invalid client secret, which is a config fault not a user one', () => {
    // The exact wording Google returns, seen in the project's Auth logs.
    const result = describeAuthError(
      'Oauth2: "invalid client" "The provided client secret is invalid."',
    );
    expect(result).toContain('client secret');
    expect(result).toContain('Supabase');
  });

  it('recognises the shapes Supabase and Google use for the same fault', () => {
    for (const raw of [
      'invalid_client',
      'Invalid Client',
      'The provided client secret is invalid.',
    ]) {
      expect(describeAuthError(raw)).toContain('client secret');
    }
  });

  it('explains a redirect mismatch', () => {
    expect(describeAuthError('Error 400: redirect_uri_mismatch')).toContain('Google Cloud');
  });

  it('points at the Auth logs when the exchange failed for an unstated reason', () => {
    // This is the message the user actually sees; it must not be a dead end.
    expect(describeAuthError('Unable to exchange external code: 4/0AVMBsJ')).toContain('Auth Logs');
  });

  it('explains a spent flow state without blaming configuration', () => {
    // Seen when the same redirect is exchanged twice; the login itself may
    // well have worked, so the message must not send anyone to the dashboard.
    for (const raw of ['flow_state_not_found', 'invalid flow state, no valid flow state found']) {
      const result = describeAuthError(raw);
      expect(result).toContain('ya se había usado');
      expect(result).not.toContain('Supabase');
    }
  });

  it('suggests retrying for a consumed or expired code', () => {
    expect(describeAuthError('invalid_grant')).toContain('caducado');
  });

  it('passes an unknown error through rather than swallowing it', () => {
    expect(describeAuthError('algo raro que nadie ha visto')).toBe('algo raro que nadie ha visto');
  });

  it('keeps the raw text alongside the explanation in development', () => {
    // Without this the friendly message would replace the only string you can
    // search for when it turns out to be something else.
    expect(describeAuthError('invalid_client')).toContain('invalid_client');
  });
});
