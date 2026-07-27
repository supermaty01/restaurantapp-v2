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

  // El camino de correo y contraseña no pasaba por aquí: signInWithEmail y
  // signUpWithEmail devolvían error.message en crudo, así que la pantalla de
  // cuenta era el único sitio de la app que hablaba en inglés.
  it.each([
    ['Invalid login credentials', 'correo o la contraseña'],
    ['missing email or phone', 'Escribe tu correo'],
    ['Password should be at least 6 characters', '6 caracteres'],
    ['User already registered', 'Ya hay una cuenta'],
    ['Unable to validate email address: invalid format', 'formato válido'],
    ['For security purposes, you can only request this after 47 seconds', 'Espera un momento'],
  ])('translates the email/password failure %p', (raw, expected) => {
    expect(describeAuthError(raw)).toContain(expected);
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
