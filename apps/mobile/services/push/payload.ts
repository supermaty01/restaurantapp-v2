/**
 * Lo que viaja dentro de una notificación push.
 *
 * Aparte de `push.ts` porque ese módulo registra el manejador de
 * expo-notificaciones **al importarlo**, y eso hace falta en el móvil y estorba
 * en un test. Aquí no hay nada nativo: es la mitad del contrato que se puede
 * comprobar sin un teléfono.
 *
 * La otra mitad la escribe el Worker (`apps/api/src/push.ts`, `composeMessage`).
 * Si los dos lados dejan de llamarlo igual, no falla nada: el aviso llega, se
 * toca, y la app abre la pantalla de inicio — que es indistinguible de que el
 * aviso no llevara a ningún sitio.
 */

/** El nombre del campo. Los dos lados tienen que decir lo mismo. */
export const VISIT_FIELD = 'visitUuid';

/** La visita que abre un aviso, si la trae. */
export function visitFromNotification(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const visit = (data as Record<string, unknown>)[VISIT_FIELD];
  return typeof visit === 'string' && visit.length > 0 ? visit : null;
}
