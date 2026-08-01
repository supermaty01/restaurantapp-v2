/**
 * La URL de una foto servida por el Worker (`GET /images/:userId/:key`, docs/05).
 *
 * Vivía en `features/social` cuando solo servía para ver las fotos de otra
 * persona. También hace falta para las propias: una foto que llegó por sync
 * tiene fila antes de tener fichero, así que hasta que la descarga termina —o
 * si falló— la única copia que existe está en R2. De ahí que esté en `lib/`,
 * que es lo que comparten `features/social` y la resolución de imágenes.
 *
 * Devuelve `undefined` cuando no hay API configurada, que es el estado normal
 * de una instalación puramente local: quien llama enseña el hueco de siempre en
 * vez de pedir una URL rota.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function remoteImageUri(
  userId: string | null | undefined,
  imageKey: string | null | undefined,
): string | undefined {
  if (!API_URL || !userId || !imageKey) return undefined;
  return `${API_URL.replace(/\/$/, '')}/images/${encodeURIComponent(userId)}/${encodeURIComponent(
    imageKey,
  )}`;
}
