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
];

export function describeAuthError(raw: string): string {
  const known = KNOWN.find((entry) => entry.match.test(raw));
  if (!known) return raw;

  // The original is kept in dev: the friendly text is for the user, the raw one
  // is what you search for.
  return __DEV__ ? `${known.message}\n\n[dev] ${raw}` : known.message;
}
