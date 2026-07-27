/**
 * Turns a provider error into something a person can act on.
 *
 * Supabase passes the raw failure through in the redirect, so the app was
 * showing users text like `Unable to exchange external code: 4/0A…` — which
 * says nothing about what is wrong or who can fix it. Every one of these took a
 * trip through the project's Auth logs to identify, so the mapping is written
 * down rather than rediscovered.
 *
 * These are all *configuration* faults: nothing the person tapping "sign in"
 * can do, which the message should say plainly instead of implying they typed
 * something wrong.
 */
interface KnownError {
  /** Matched case-insensitively against the provider's message. */
  match: RegExp;
  message: string;
}

const KNOWN: KnownError[] = [
  {
    // Google's wording for a client secret that does not match the client id.
    match: /client secret is invalid|invalid[_ ]client/i,
    message:
      'El proveedor rechazó las credenciales de la app. El client secret configurado en Supabase no coincide con el de Google Cloud.',
  },
  {
    match: /redirect_uri_mismatch/i,
    message:
      'La URL de retorno no está registrada en Google Cloud. Debe ser exactamente la Callback URL que muestra Supabase.',
  },
  {
    // A PKCE flow state is single use. Seeing this usually means the same
    // redirect was exchanged twice rather than that anything is misconfigured.
    match: /flow[_ ]state[_ ]not[_ ]found|invalid flow state/i,
    message: 'Ese enlace de acceso ya se había usado. Vuelve a intentar iniciar sesión.',
  },
  {
    match: /invalid[_ ]grant/i,
    message:
      'El código de acceso ya se había usado o ha caducado. Vuelve a intentarlo; si se repite, revisa la hora del dispositivo.',
  },
  {
    match: /unable to exchange external code/i,
    message:
      'Supabase no pudo canjear el código con el proveedor. Revisa los Auth Logs del proyecto: el motivo exacto está ahí.',
  },
  {
    match: /provider is not enabled|unsupported provider/i,
    message: 'Ese método de inicio de sesión no está habilitado en Supabase.',
  },
  {
    match: /email.*not confirmed/i,
    message: 'Confirma tu correo antes de entrar.',
  },

  // Correo y contraseña. A diferencia de las de arriba, estas sí las causa
  // quien está escribiendo, así que la redacción va dirigida a esa persona y no
  // a quien configura el proyecto.
  {
    match: /invalid login credentials/i,
    message: 'El correo o la contraseña no son correctos.',
  },
  {
    match: /missing email or phone/i,
    message: 'Escribe tu correo.',
  },
  {
    match: /(signup|password) requires a valid password|password should be at least/i,
    message: 'La contraseña tiene que tener al menos 6 caracteres.',
  },
  {
    match: /user already registered|already been registered/i,
    message: 'Ya hay una cuenta con ese correo. Inicia sesión en vez de crearla.',
  },
  {
    match: /unable to validate email address|invalid format/i,
    message: 'Ese correo no tiene un formato válido.',
  },
  {
    // Supabase limita los reintentos por proyecto; el número de segundos viene
    // en el mensaje crudo, que en dev se sigue viendo debajo.
    match: /for security purposes|over_email_send_rate_limit|too many requests/i,
    message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
  },
  {
    match: /email logins are disabled|signups not allowed/i,
    message: 'El registro con correo está desactivado en el servidor.',
  },
];

export function describeAuthError(raw: string): string {
  const known = KNOWN.find((entry) => entry.match.test(raw));
  if (!known) return raw;

  // The original is kept in dev: the friendly text is for the user, the raw one
  // is what you search for.
  return __DEV__ ? `${known.message}\n\n[dev] ${raw}` : known.message;
}
