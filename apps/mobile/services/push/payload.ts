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

/** Los nombres de los campos. Los dos lados tienen que decir lo mismo. */
export const VISIT_FIELD = 'visitUuid';
export const ACTOR_FIELD = 'actorId';

function field(data: unknown, name: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const value = (data as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** La visita que abre un aviso, si la trae. */
export function visitFromNotification(data: unknown): string | null {
  return field(data, VISIT_FIELD);
}

/**
 * Quién lo provocó.
 *
 * Es el destino de las clases que no ocurren en una comida —una solicitud de
 * amistad, una aceptación, un amigo que ha publicado algo—: su perfil. Sin
 * esto, tocar cualquiera de esas tres abre la pantalla de inicio, que desde
 * fuera es igual que un aviso roto.
 */
export function actorFromNotification(data: unknown): string | null {
  return field(data, ACTOR_FIELD);
}
