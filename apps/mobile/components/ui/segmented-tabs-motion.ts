/**
 * La aritmética del pager de `SegmentedTabs`, fuera del componente.
 *
 * No es una separación por gusto: **reanimated no se puede importar en jest**
 * —`react-native-worklets` busca su módulo nativo y revienta al cargar, antes
 * de llegar a ninguna prueba—, así que cualquier cosa que viva dentro del
 * componente es, hoy, código sin red. Aquí están las dos decisiones que de
 * verdad pueden estar mal: a qué página se va al soltar, y dónde queda la
 * pastilla. El resto del componente es pegamento.
 *
 * Las dos son funciones puras y llevan `'worklet'` para poder llamarse desde el
 * hilo de UI.
 */

/** Lo que hay que arrastrar, o lanzar, para que cuente como cambio de página. */
export const SWIPE_DISTANCE = 60;
export const SWIPE_VELOCITY = 500;

/**
 * Cuánto se estira la pastilla al pasar de un segmento a otro.
 *
 * Es el «efecto gota»: una pastilla que se desliza rígida se lee como algo que
 * salta de sitio; una que se alarga a mitad de camino y se recoge al llegar se
 * lee como una sola cosa que se mueve. 1 sería no estirarse nada.
 */
export const DROP_STRETCH = 1.3;

/** El `p-1` del carril: lo que la pastilla no puede ocupar por cada lado. */
export const TRACK_PADDING = 4;

/**
 * A qué página se va al soltar el dedo.
 *
 * Cuenta la velocidad además de la distancia: un lanzamiento corto y rápido es
 * un cambio de página tan claro como un arrastre lento y largo, y exigir los
 * dos convierte el gesto en algo que hay que hacer con ganas.
 *
 * Salta **una sola página por gesto** aunque el arrastre haya sido de tres
 * pantallas. Con tres pestañas, un arrastre que se pasa de largo llevaría de la
 * primera a la última sin enseñar la de en medio, que es lo contrario de lo que
 * un pager cuenta.
 */
export function pageAfterSwipe({
  from,
  translationX,
  velocityX,
  count,
}: {
  from: number;
  translationX: number;
  velocityX: number;
  count: number;
}): number {
  'worklet';
  const far = Math.abs(translationX) >= SWIPE_DISTANCE;
  const fast = Math.abs(velocityX) >= SWIPE_VELOCITY;
  if (!far && !fast) return from;

  const delta = translationX < 0 ? 1 : -1;
  return Math.min(count - 1, Math.max(0, from + delta));
}

/**
 * Dónde y cuánto mide la pastilla para una posición continua del pager.
 *
 * `position` va en unidades de página: 1.5 es «a mitad entre la 1 y la 2». Sale
 * del desplazamiento del pager y no del estado, que es lo que hace que el
 * indicador siga al dedo en vez de animarse por su cuenta cuando ya ha
 * cambiado la pestaña.
 */
export function thumbGeometry({
  position,
  count,
  trackWidth,
}: {
  position: number;
  count: number;
  trackWidth: number;
}): { left: number; width: number } {
  'worklet';
  const inner = trackWidth - TRACK_PADDING * 2;
  const segment = inner / count;

  const clamped = Math.min(count - 1, Math.max(0, position));
  const fraction = clamped - Math.floor(clamped);
  // Triángulo: 0 en los extremos, 1 en el punto medio. Es el estirón.
  const peak = 1 - Math.abs(fraction - 0.5) * 2;
  const width = segment * (1 + (DROP_STRETCH - 1) * peak);

  // El estirón crece hacia los dos lados desde el centro del segmento, así que
  // la izquierda se corrige con la mitad de lo que ha crecido. Sin esa
  // corrección la pastilla se estira solo hacia la derecha y se sale del carril
  // en el último segmento.
  const left = TRACK_PADDING + clamped * segment - (width - segment) / 2;

  return {
    width,
    left: Math.min(TRACK_PADDING + inner - width, Math.max(TRACK_PADDING, left)),
  };
}
