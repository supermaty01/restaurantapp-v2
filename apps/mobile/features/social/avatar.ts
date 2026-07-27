import * as FileSystem from 'expo-file-system/legacy';

import { accessToken, deleteImage, workerBaseUrl } from '@/services/api/worker';

/**
 * Subir una foto de perfil.
 *
 * Va al mismo sitio que las fotos del diario —R2 por el Worker— en vez de a
 * Supabase Storage: es un bucket menos que configurar y la ruta de lectura ya
 * es pública, que es lo que necesita un avatar para que lo vean tus amigos.
 *
 * **La clave lleva la hora, y eso no es decoración.** El Worker sirve las
 * imágenes con `cache-control: immutable, max-age=31536000`, que es correcto
 * porque las claves del diario son uuids y nunca cambian de contenido. Un
 * avatar sí cambia. Con una clave fija (`avatar`) la foto nueva quedaría
 * escondida detrás de la vieja durante un año en la caché de cada dispositivo
 * que la hubiera visto, y no hay forma de invalidarla desde aquí. Una clave
 * nueva por subida convierte ese `immutable` de problema en ventaja.
 */
export async function uploadAvatar(localUri: string, accountUuid: string): Promise<string> {
  const base = workerBaseUrl();
  if (!base) throw new Error('No hay servidor configurado para las fotos');

  const token = await accessToken();
  if (!token) throw new Error('No has iniciado sesión');

  const key = `avatar-${Date.now()}`;

  const upload = await FileSystem.uploadAsync(
    `${base}/images/${encodeURIComponent(key)}`,
    localUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    },
  );

  if (upload.status < 200 || upload.status >= 300) {
    const body = (upload.body ?? '').slice(0, 200);
    throw new Error(`No se pudo subir la foto (HTTP ${upload.status}${body ? `: ${body}` : ''})`);
  }

  // La misma forma que usa `remoteImageUri` para las fotos ajenas: el segmento
  // del dueño es lo que hace pública la lectura.
  return `${base}/images/${encodeURIComponent(accountUuid)}/${encodeURIComponent(key)}`;
}

/**
 * Retira la anterior de R2, si era nuestra.
 *
 * Best-effort a propósito: si falla, lo único que queda es un fichero huérfano
 * que nadie sirve. Hacer que un borrado de limpieza pueda tumbar el cambio de
 * foto sería cambiar algo que importa por algo que no.
 *
 * Solo toca claves con nuestra forma: un `avatar_url` que venga de Google
 * apunta a googleusercontent.com y ahí no hay nada nuestro que borrar.
 */
export async function deletePreviousAvatar(previousUrl: string | null): Promise<void> {
  const base = workerBaseUrl();
  if (!base || !previousUrl) return;
  if (!previousUrl.startsWith(`${base}/images/`)) return;

  const key = previousUrl.split('/').pop();
  if (!key?.startsWith('avatar-')) return;

  // La mecánica de hablar con el Worker vive en services/api; aquí queda solo la
  // decisión de qué borrar y cuándo, que es lo propio de esta feature.
  await deleteImage(key);
}
