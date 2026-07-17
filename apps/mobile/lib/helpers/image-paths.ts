import { IMAGES_DIR } from '@/lib/helpers/fs-paths';

/**
 * @param rawPath Ruta previa (puede ser URI http, data:, file://... o sólo nombre)
 * @returns Siempre file:///…/images/{filename}
 */
export function normalizeImagePath(rawPath: string): string {
  if (!rawPath) {
    return '';
  }

  // Si es URL remota o data URI, la devolvemos sin tocar
  if (/^(https?:\/\/|data:)/.test(rawPath)) {
    return rawPath;
  }

  // Limpiar prefijo file://
  const localPath = rawPath.replace(/^file:\/\//, '');

  // Sacar sólo el nombre de fichero
  const filename = localPath.split('/').pop();
  if (!filename) {
    return rawPath;
  }

  const newPath = `${IMAGES_DIR}${filename}`;

  return newPath;
}

export function imagePathToUri(path: string): string {
  const normalized = normalizeImagePath(path);
  // expo Image acepta file:///… directamente
  return normalized.startsWith('file://') ? normalized : `file://${normalized}`;
}
