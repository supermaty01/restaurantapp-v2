/**
 * Qué copias sobran de una tanda anterior.
 *
 * Aparte de `backupService.ts` por la misma razón que `push/payload.ts` lo está
 * de `push.ts`: ese módulo importa `expo-file-system` y `expo-sharing`, y el
 * proyecto de tests de Node —donde vive esto— no tiene un entorno de Expo que
 * los resuelva. Aquí no hay nada nativo: es la decisión, que es justo lo que
 * puede volver a romperse.
 *
 * El fallo que arregla: cada exportación escribía un zip con la hora en el
 * nombre y **nadie lo borraba nunca**. Un zip pesa casi lo que la carpeta de
 * imágenes entera, porque un zip no comprime JPEG —ya vienen comprimidos—, así
 * que cinco o diez exportaciones son el giga o dos que se veía en el móvil.
 */

/**
 * Los dos tipos de zip, con nombres distintos porque tienen vidas distintas.
 *
 * Compartían nombre, y eso hacía imposible barrer uno sin llevarse el otro por
 * delante — que es parte de por qué no se barría ninguno.
 */
export const EXPORT_PREFIX = 'restaurantapp_backup_';
export const SAFETY_PREFIX = 'restaurantapp_safety_';

/**
 * De todo lo que hay en la carpeta, qué se puede borrar.
 *
 * `restaurantapp_backup_*` es además el nombre que usaban **las dos** clases
 * antes de esta separación, así que barrerlo recupera de paso lo acumulado en
 * las instalaciones que ya existen. Se puede borrar sin miedo: ningún camino
 * del código lee nunca la ruta de un zip salvo el `shareBackup` inmediato, y la
 * pantalla de Ajustes solo enseña la **fecha** de la última copia, nunca su
 * fichero.
 */
export function archivesToPrune(names: string[], prefix: string): string[] {
  return names.filter((name) => name.startsWith(prefix) && name.endsWith('.zip'));
}
