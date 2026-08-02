import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { LayoutChangeEvent } from 'react-native';

/**
 * Una cabecera que se encoge al bajar por la lista.
 *
 * ## Por qué existe
 *
 * La ficha de una persona —foto de 72, nombre, @, bio, los dos contadores y el
 * botón de quitar de amigos— ocupa **más de media pantalla**, y ahí lo que se
 * viene a ver es lo que ha comido. Todo eso se lee una vez al entrar; a partir
 * del segundo dedo hacia abajo es un cartel tapando la lista.
 *
 * ## Lo que se descartó
 *
 * **Meter la ficha como `ListHeaderComponent`** de cada lista, que es la forma
 * de que se vaya con el desplazamiento sin nada de esta maquinaria. No vale
 * aquí por dos motivos: las pestañas son un pager con las tres páginas montadas
 * a la vez, así que habría tres copias de la ficha y el desplazamiento de una
 * no movería las otras; y la ficha se iría **entera**, dejando la pantalla sin
 * decir de quién es el perfil que estás leyendo.
 *
 * Así que no se va: se reduce a una barra con la cara y el nombre, y vuelve
 * entera en cuanto subes. Es el mismo trato que hace un perfil de cualquier red
 * social, y por el mismo motivo.
 *
 * ## Cómo mide
 *
 * La altura desplegada **se mide, no se estima**: depende de si hay bio, de
 * cuántas líneas ocupe y de qué botón de relación toque pintar (uno, dos, o
 * ninguno si eres tú). Hasta que `onLayout` contesta, el contenedor va a altura
 * automática y no hay animación — es un fotograma, y es preferible a un salto
 * desde una altura inventada.
 */

/** Lo que queda cuando está recogida: una fila con la cara y el nombre. */
export const COLLAPSED_HEIGHT = 58;

/**
 * Cuánto hay que desplazar para recogerla del todo.
 *
 * No es la altura desplegada: si lo fuera, la cabecera se encogería exactamente
 * al ritmo del dedo y el efecto sería idéntico a que se fuera con la lista. Un
 * recorrido más corto la recoge pronto y deja el resto del desplazamiento para
 * la lista, que es lo que se ha venido a leer.
 */
const COLLAPSE_DISTANCE = 110;

export function CollapsingHeader({
  scrollY,
  expanded,
  collapsed,
}: {
  /** Cuánto ha bajado la lista activa. Lo escriben las secciones. */
  scrollY: SharedValue<number>;
  expanded: ReactNode;
  /** La barra que queda al recogerse. Debe caber en `COLLAPSED_HEIGHT`. */
  collapsed: ReactNode;
}) {
  const [fullHeight, setFullHeight] = useState(0);

  /*
   * Quién recibe los toques, y por qué esto sí cruza al hilo de JavaScript.
   *
   * Con la ficha desvanecida sigue estando ahí, y sus primeros 58 píxeles —la
   * foto— caen justo donde ahora hay una barra. Sin esto, tocar la cara del
   * perfil recogido abriría el visor de la foto, que es lo que había debajo.
   *
   * `pointerEvents` no es un estilo, así que no se puede interpolar como la
   * opacidad; hay que decírselo a React. Cruza **una vez por umbral**, no en
   * cada fotograma, que es lo que lo hace asumible.
   */
  const [folded, setFolded] = useState(false);
  useAnimatedReaction(
    () => scrollY.value >= COLLAPSE_DISTANCE * 0.55,
    (isFolded, wasFolded) => {
      if (isFolded !== wasFolded) runOnJS(setFolded)(isFolded);
    },
  );

  const measure = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // Con tolerancia: un `setState` por cada píxel de diferencia es un bucle de
    // renders, y las medidas de layout no son enteras.
    setFullHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  };

  const containerStyle = useAnimatedStyle(() => {
    if (fullHeight === 0) return {};
    return {
      height: interpolate(
        scrollY.value,
        [0, COLLAPSE_DISTANCE],
        [fullHeight, COLLAPSED_HEIGHT],
        Extrapolation.CLAMP,
      ),
    };
  }, [fullHeight]);

  const expandedStyle = useAnimatedStyle(() => ({
    // Se apaga antes de que el contenedor termine de encogerse, o los últimos
    // píxeles serían la ficha recortada por la mitad en vez de desvanecida.
    opacity: interpolate(scrollY.value, [0, COLLAPSE_DISTANCE * 0.55], [1, 0], Extrapolation.CLAMP),
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * 0.55, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View style={[{ overflow: 'hidden' }, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          collapsedStyle,
          { position: 'absolute', top: 0, left: 0, right: 0, height: COLLAPSED_HEIGHT },
        ]}
      >
        {collapsed}
      </Animated.View>

      <Animated.View pointerEvents={folded ? 'none' : 'auto'} style={expandedStyle}>
        <View onLayout={measure}>{expanded}</View>
      </Animated.View>
    </Animated.View>
  );
}
