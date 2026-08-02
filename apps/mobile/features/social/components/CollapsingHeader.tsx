import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { COLLAPSED_HEIGHT, headerProgress } from './collapsing-header-motion';

import type { LayoutChangeEvent } from 'react-native';

/**
 * La ficha de una persona, que se recoge al bajar por su lista.
 *
 * ## Por qué existe
 *
 * Foto de 72, nombre, @, bio, dos contadores y el botón de quitar de amigos:
 * **más de media pantalla**, en una pantalla a la que se entra a ver lo que ha
 * comido alguien. Todo eso se lee una vez al entrar; a partir del segundo dedo
 * hacia abajo es un cartel tapando la lista.
 *
 * ## Qué hace exactamente
 *
 * La cabecera **se come los primeros `range` píxeles** del gesto: mientras
 * dura, el bloque entero sube y la lista no pasa de largo; pasados esos
 * píxeles, la cabecera se queda quieta en su tamaño pequeño y el resto del
 * desplazamiento es de la lista. Al volver a subir, se mantiene pequeña hasta
 * llegar arriba. La regla y las tres frases con las que se pidió están en
 * `collapsing-header-motion.ts`.
 *
 * ## Este componente ya no anima ninguna altura, y eso es el arreglo
 *
 * Las dos primeras versiones movían la altura del contenedor, y ahí está el
 * fallo que se reportó dos veces: cambiar la altura cambia el alto de la lista,
 * lo que cambia su desplazamiento máximo, lo que hace que Android recorte el
 * desplazamiento actual, lo que vuelve a mover la altura. Un bucle entre el
 * layout y el gesto, que en pantalla se ve como un parpadeo.
 *
 * Ahora nada de esto participa en el layout: `SegmentedTabs` pinta este bloque
 * **flotando** sobre las páginas y les da el hueco de arriba como `paddingTop`.
 * Lo único que se mueve con el dedo es el `translateY` del bloque, que aplica
 * él. Aquí solo quedan dos opacidades y una barra que se queda pegada arriba.
 *
 * ## Lo que se descartó
 *
 * **Meter la ficha como `ListHeaderComponent`**, que es la forma de que se vaya
 * con el desplazamiento sin nada de esta maquinaria. No vale por dos motivos:
 * las pestañas son un pager con las tres páginas montadas a la vez, así que
 * habría tres copias y el desplazamiento de una no movería las otras; y la
 * ficha se iría **entera**, dejando la pantalla sin decir de quién es el perfil
 * que estás leyendo.
 */
export function CollapsingHeader({
  offset,
  range,
  expanded,
  compact,
}: {
  /** Cuánto ha subido el bloque, en píxeles. Entre 0 y `range`. */
  offset: SharedValue<number>;
  /**
   * Cuánto puede encogerse la ficha: su alto medido menos `COLLAPSED_HEIGHT`.
   * Lo escribe este componente al medirse y lo lee quien sigue el gesto.
   */
  range: SharedValue<number>;
  expanded: ReactNode;
  /** La barra que queda al recogerse. Debe caber en `COLLAPSED_HEIGHT`. */
  compact: ReactNode;
}) {
  /*
   * La altura desplegada **se mide, no se estima**: depende de si hay bio, de
   * cuántas líneas ocupe y de qué botón de relación toque pintar (uno, dos, o
   * ninguno si eres tú). Hasta que `onLayout` contesta, `range` vale 0 y la
   * cabecera no se mueve — un fotograma quieta, que es preferible a un salto
   * desde una altura inventada.
   */
  const measure = (event: LayoutChangeEvent) => {
    // Directo al valor compartido: nada de esto necesita un render de React, y
    // un `setState` por cada píxel de una medida de layout —que no es entera—
    // sería un bucle de renders.
    range.value = Math.max(0, event.nativeEvent.layout.height - COLLAPSED_HEIGHT);
  };

  /*
   * Quién recibe los toques, y por qué esto sí cruza al hilo de JavaScript.
   *
   * Con la ficha desvanecida sigue estando ahí, y una vez recogida sus píxeles
   * visibles son los de la barra. Sin esto, tocar la barra abriría lo que había
   * debajo — el visor de la foto de perfil.
   *
   * `pointerEvents` no es un estilo, así que no se puede interpolar como la
   * opacidad; hay que decírselo a React. Cruza **una vez por umbral**, no en
   * cada fotograma, que es lo que lo hace asumible.
   */
  const [folded, setFolded] = useState(false);
  useAnimatedReaction(
    () => (range.value > 0 ? offset.value / range.value > 0.5 : false),
    (isFolded, wasFolded) => {
      if (isFolded !== wasFolded) runOnJS(setFolded)(isFolded);
    },
  );

  /*
   * La ficha se apaga **al ritmo del recorrido**, ni más rápido ni más lento.
   *
   * El primer intento la apagaba al doble de velocidad, y a mitad de gesto se
   * veía un agujero: el bloque sigue subiendo después de que la ficha sea
   * invisible, así que el espacio que todavía ocupa se ve como lienzo vacío
   * entre la barra y el carril de pestañas. Yendo a la par, ese espacio lo llena
   * la propia ficha cada vez más tenue, que es lo que se espera ver.
   */
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: 1 - headerProgress(offset.value, range.value),
  }));

  /*
   * La barra se queda pegada arriba mientras el bloque sube.
   *
   * Contra-desplazamiento: el bloque entero sube `offset`, así que la barra baja
   * lo mismo dentro de él y el resultado es que no se mueve de la pantalla. Sin
   * esto se iría hacia arriba con la ficha y al recogerse no quedaría nada.
   */
  const compactStyle = useAnimatedStyle(() => ({
    // Y la barra entra en el último tercio: antes competiría con la ficha, que
    // todavía se está leyendo.
    opacity: Math.max(0, headerProgress(offset.value, range.value) * 1.5 - 0.5),
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View style={{ minHeight: COLLAPSED_HEIGHT }}>
      <Animated.View pointerEvents={folded ? 'none' : 'auto'} style={expandedStyle}>
        <View onLayout={measure}>{expanded}</View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          compactStyle,
          { position: 'absolute', top: 0, left: 0, right: 0, height: COLLAPSED_HEIGHT },
        ]}
      >
        {compact}
      </Animated.View>
    </View>
  );
}
