/**
 * Cuándo se recoge la ficha de un perfil, y por qué la decisión vive aquí.
 *
 * Fuera del componente porque el componente importa reanimated, y reanimated no
 * se puede importar en jest (docs/12). Es el mismo reparto que
 * `segmented-tabs-motion.ts`: la regla en un módulo que se puede probar, el
 * pintado en el que no.
 *
 * Y hay mucho que probar, porque esta regla nació de un fallo:
 *
 * > «Creo que hay dos eventos que se activan a la vez mientras scrolleo para
 * > abajo y la sección de arriba se recorta/agranda todo el tiempo, generando
 * > un parpadeo exagerado.»
 *
 * Los dos eventos eran uno solo dando vueltas. La primera versión interpolaba
 * la altura de la cabecera **desde el desplazamiento**, y eso cierra un lazo
 * entre el layout y el gesto:
 *
 *     la cabecera encoge  →  la lista crece  →  su desplazamiento máximo baja
 *       →  Android recorta el desplazamiento  →  la cabecera crece  →  …
 *
 * Lo que corta el lazo son tres cosas, y las tres hacen falta. Dos están en el
 * componente —la altura se anima hacia un valor constante, y el estado es
 * binario— y la tercera es esta función.
 */

/** Lo que queda cuando está recogida: una fila con la cara y el nombre. */
export const COLLAPSED_HEIGHT = 58;

/** Se recoge pasado esto… */
export const COLLAPSE_AT = 96;

/** …y no vuelve a desplegarse hasta por debajo de esto. */
export const EXPAND_AT = 40;

export interface CollapseRoom {
  /** Cuánto espacio le devuelve a la lista recogerse. */
  range: number;
  /** Cuánto puede desplazarse la lista ahora mismo: contenido − ventana. */
  scrollable: number;
}

/**
 * Si a esta altura de desplazamiento toca estar recogida.
 *
 * **Histéresis**: los dos umbrales son distintos a propósito. Con uno solo,
 * cualquier temblor de un píxel alrededor del umbral —y el recorte de Android
 * es bastante más que un píxel— cambia el estado de ida y de vuelta.
 *
 * **Y la comprobación de sitio**, que es la que salva a las listas cortas.
 * Recogerse le devuelve `range` píxeles a la lista, así que su desplazamiento
 * máximo baja en `range`. Si eso lo dejara por debajo del umbral de volver a
 * desplegarse, recogerse provocaría un recorte que la desplegaría otra vez, y
 * de ahí no se sale. Con cuatro entradas en la sección eso es exactamente lo
 * que pasaba, y por eso no basta con la histéresis.
 *
 * Solo se comprueba al **recogerse**: desplegarse devuelve espacio a la
 * cabecera, o sea que la lista solo puede ganar recorrido, y ahí no hay nada
 * que pueda rebotar.
 *
 * Marcada como worklet para poder llamarla desde el manejador de
 * desplazamiento, que corre en el hilo de interfaz.
 */
export function shouldCollapse(
  offsetY: number,
  wasCollapsed: boolean,
  { range, scrollable }: CollapseRoom,
): boolean {
  'worklet';
  if (wasCollapsed) return offsetY > EXPAND_AT;
  return offsetY > COLLAPSE_AT && scrollable - range > EXPAND_AT;
}
