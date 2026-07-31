/**
 * Turns a provider error into something a person can act on.
 *
 * Supabase passes the raw failure through in the redirect, so the app was
 * showing users text like `Unable to exchange external code: 4/0A…` — which
 * says nothing about what is wrong or who can fix it. Every one of these took a
 * trip through the project's Auth logs to identify, so the mapping is written
 * down rather than rediscovered.
 *
 * Dos familias, y conviene no mezclarlas al leer la lista:
 *
 * - **Fallos de configuración** (OAuth): nada que pueda hacer quien pulsa
 *   «entrar», y el mensaje tiene que decirlo en vez de insinuar que ha escrito
 *   algo mal.
 * - **Fallos de quien entra** (correo y contraseña): sí puede hacer algo, y lo
 *   que hacía falta era decirlo en su idioma. Supabase contesta en inglés
 *   —«Invalid login credentials»— y eso es lo que salía tal cual en una app
 *   escrita entera en español.
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
    message:
      'Todavía no has confirmado tu correo. Busca el mensaje que te enviamos y abre el enlace.',
  },

  // ── Correo y contraseña ────────────────────────────────────────────────────
  {
    // Lo que contesta Supabase tanto si el correo no existe como si la
    // contraseña está mal, a propósito: distinguirlos le diría a cualquiera qué
    // correos tienen cuenta. El mensaje mantiene la ambigüedad.
    match: /invalid login credentials/i,
    message: 'El correo o la contraseña no coinciden.',
  },
  {
    match: /user already registered|already registered/i,
    message: 'Ya hay una cuenta con ese correo. Entra en vez de crearla.',
  },
  {
    match: /password should be at least (\d+)/i,
    message: 'La contraseña es demasiado corta.',
  },
  {
    match: /password.*at least|weak password/i,
    message: 'Esa contraseña es demasiado débil. Prueba con una más larga.',
  },
  {
    match: /unable to validate email|invalid email|email address.*invalid/i,
    message: 'Ese correo no tiene buena pinta. Revisa que esté bien escrito.',
  },
  {
    match: /for security purposes|rate limit|too many requests/i,
    message: 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
  },
  {
    match: /signups not allowed|signup is disabled/i,
    message: 'El registro está cerrado en este momento.',
  },
  {
    // `fetch failed` es lo que sale sin red, y no dice nada a nadie.
    match: /network request failed|fetch failed|failed to fetch/i,
    message: 'No hay conexión con el servidor. Comprueba tu red y vuelve a intentarlo.',
  },
];

export function describeAuthError(raw: string): string {
  const known = KNOWN.find((entry) => entry.match.test(raw));
  if (!known) return raw;

  // The original is kept in dev: the friendly text is for the user, the raw one
  // is what you search for.
  return __DEV__ ? `${known.message}\n\n[dev] ${raw}` : known.message;
}
