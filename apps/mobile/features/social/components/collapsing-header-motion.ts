/**
 * Cuánto se ha recogido la ficha de un perfil, y por qué la regla vive aquí.
 *
 * Fuera del componente porque el componente importa reanimated, y reanimated no
 * se puede importar en jest (docs/12). Es el mismo reparto que
 * `segmented-tabs-motion.ts`: la regla en un módulo que se puede probar, el
 * pintado en el que no.
 *
 * ## Lo que tiene que hacer, dicho por quien lo usa
 *
 * > - Al iniciar a scrollear, no se debería mover aún la lista, solo reducir el
 * >   tamaño del header.
 * > - Cuando el header esté de tamaño, se retoma el control del scroll por la
 * >   lista y se comienza a bajar.
 * > - Cuando se está abajo en la lista y se scrollea para arriba, se debe
 * >   mantener el header pequeño hasta que se llegue arriba.
 *
 * O sea: la cabecera **se come los primeros `range` píxeles** del gesto y
 * después suelta el scroll. Las tres frases son la misma función —
 * `min(max(y, 0), range)`— leída en los tres tramos, y por eso no hay umbrales,
 * ni histéresis, ni estados. Eso fue el intento anterior y era un parche.
 *
 * ## Y por qué esto no vuelve a parpadear
 *
 * El primer intento interpolaba la **altura** de la cabecera desde el
 * desplazamiento, y eso cierra un lazo entre el layout y el gesto:
 *
 *     la cabecera encoge  →  la lista de abajo crece
 *       →  su desplazamiento máximo baja
 *       →  Android recorta el desplazamiento actual para que quepa
 *       →  llega un `onScroll` con menos desplazamiento
 *       →  la cabecera crece  →  vuelta a empezar
 *
 * El segundo intento cortó el lazo volviendo el estado binario, y el precio fue
 * perder justo el comportamiento que se pedía. La salida buena es la otra: que
 * **la cabecera no participe en el layout**. Va flotando sobre la lista, la
 * lista lleva un hueco arriba del tamaño de la cabecera desplegada, y lo único
 * que cambia con el dedo es un `translateY`. El alto de la lista, su contenido y
 * su desplazamiento máximo son constantes, así que no hay nada que recortar y no
 * hay lazo que cerrar.
 *
 * La lección, que es la que conviene no perder: **si una animación atada al
 * gesto cambia el layout del contenedor del gesto, es un bucle, no un efecto.**
 * No se arregla suavizándola; se arregla sacándola del layout.
 */

/** Lo que queda cuando está recogida: una fila con la cara y el nombre. */
export const COLLAPSED_HEIGHT = 58;

/**
 * Cuánto tiene que subir la cabecera para este desplazamiento.
 *
 * `range` es lo que la ficha puede encogerse: su altura desplegada menos
 * `COLLAPSED_HEIGHT`. Devuelve entre 0 y `range`, nunca fuera:
 *
 * - **Por abajo**, porque estirar la lista hacia arriba (el rebote de iOS) da
 *   desplazamientos negativos, y sin el tope la cabecera bajaría más de lo que
 *   mide, dejando un hueco entre ella y la lista.
 * - **Por arriba**, porque pasado `range` la cabecera ya está recogida del todo
 *   y lo que sigue es scroll de la lista. Ese tope **es** la tercera frase de
 *   arriba: al volver a subir, la cabecera no empieza a crecer hasta que el
 *   desplazamiento vuelve a caer por debajo de `range`, o sea al llegar arriba.
 *
 * Marcada como worklet para poder llamarla desde el manejador de
 * desplazamiento, que corre en el hilo de interfaz.
 */
export function headerOffset(scrollY: number, range: number): number {
  'worklet';
  if (!(range > 0)) return 0;
  return Math.min(Math.max(scrollY, 0), range);
}

/**
 * Lo mismo en 0..1, que es lo que quieren las opacidades.
 *
 * Aparte de `headerOffset` y no derivado en el componente porque la división por
 * cero tiene que estar resuelta en un solo sitio: `range` vale 0 hasta que la
 * ficha se mide, y en ese primer fotograma `offset / range` es `NaN`, que en un
 * estilo de reanimated no falla — deja la vista invisible.
 */
export function headerProgress(scrollY: number, range: number): number {
  'worklet';
  if (!(range > 0)) return 0;
  return headerOffset(scrollY, range) / range;
}
