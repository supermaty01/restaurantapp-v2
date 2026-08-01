/**
 * Las llamadas al Worker, en un solo sitio.
 *
 * docs/12 dice desde el principio que solo `services/` habla con la red, y era
 * verdad salvo por dos sitios: el agente del asistente y el borrado del avatar
 * anterior, que hacían su propio `fetch` desde `features/`. Dos no es una
 * catástrofe — y por eso mismo es el momento de recogerlos, antes de que sean
 * cinco y mover cualquier cosa (una cabecera, un reintento, un timeout) haya que
 * hacerlo cinco veces.
 *
 * Aquí no hay lógica de dominio: es la mecánica de hablar con el Worker. Quién
 * llama y para qué sigue viviendo en su feature.
 */
import { getSupabase } from '@/services/supabase/client';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** La base sin barra final, o null si la app corre sin nube. */
export function workerBaseUrl(): string | null {
  return API_URL ? API_URL.replace(/\/$/, '') : null;
}

/** El token de la sesión actual, o null si no hay sesión. */
export async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export class WorkerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

/**
 * Una petición autenticada al Worker.
 *
 * Lanza `WorkerError` con el código, que es lo que permite a quien llama
 * distinguir «no has iniciado sesión» de «el Worker está caído» sin volver a
 * inspeccionar la respuesta.
 */
export async function workerFetch(
  path: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const base = workerBaseUrl();
  if (!base) throw new WorkerError('No hay servidor configurado', 0);

  const token = await accessToken();
  if (!token) throw new WorkerError('No has iniciado sesión', 401);

  const response = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: init.body }),
  });

  if (!response.ok) {
    throw new WorkerError(`${path}: HTTP ${String(response.status)}`, response.status);
  }
  return response;
}

/**
 * Borra un objeto de R2. Best-effort a propósito.
 *
 * Se usa para retirar el avatar anterior: si falla, lo único que queda es un
 * fichero huérfano que nadie sirve. Hacer que una limpieza pueda tumbar el
 * cambio de foto sería cambiar algo que importa por algo que no.
 */
export async function deleteImage(key: string): Promise<void> {
  try {
    await workerFetch(`/images/${encodeURIComponent(key)}`, { method: 'DELETE' });
  } catch {
    // Ver arriba: un huérfano en R2 no es motivo para fallar nada.
  }
}
