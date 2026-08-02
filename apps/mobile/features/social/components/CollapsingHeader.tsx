import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { COLLAPSED_HEIGHT } from './collapsing-header-motion';

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
 * ## El parpadeo, que es lo que enseñó cómo hay que hacer esto
 *
 * La primera versión interpolaba la altura **desde el desplazamiento**: cada
 * píxel que bajabas encogía la cabecera un poco. Se ve muy bien en un vídeo y
 * en el móvil parpadeaba sin parar, «como si hubiera dos eventos peleándose».
 * Los había, y son estos:
 *
 *     la cabecera encoge  →  la lista de abajo crece
 *       →  su desplazamiento máximo baja
 *       →  Android recorta el desplazamiento actual para que quepa
 *       →  llega un `onScroll` con menos desplazamiento
 *       →  la cabecera crece  →  la lista encoge  →  vuelta a empezar
 *
 * Es un bucle de realimentación entre el layout y el gesto, y **no se arregla
 * suavizando**: mientras la altura salga del desplazamiento, el desplazamiento
 * seguirá saliendo de la altura. Hay que cortar el lazo.
 *
 * Así que la cabecera tiene **dos estados**, no un continuo:
 *
 * 1. La altura se anima hacia un valor **constante** —desplegada o recogida—,
 *    nunca hacia uno que dependa del dedo. Un recorte a mitad de la animación
 *    ya no puede mover el destino.
 * 2. El cambio de estado lleva **histéresis**: se recoge pasados 96 px y no
 *    vuelve a desplegarse hasta por debajo de 40. Un recorte pequeño no puede
 *    devolverte al otro lado.
 * 3. Y quien decide comprueba antes que **la lista tenga sitio que devolver**
 *    (ver `shouldCollapse`). Si al recoger la cabecera la lista se quedara sin
 *    recorrido, el recorte sería inevitable, así que en ese caso no se recoge.
 *
 * Las tres son necesarias. Con solo la primera, una lista corta sigue
 * oscilando; con solo la tercera, el continuo sigue peleándose con el recorte.
 *
 * ## Lo que se descartó
 *
 * **Meter la ficha como `ListHeaderComponent`**, que es la forma de que se vaya
 * con el desplazamiento sin nada de esta maquinaria. No vale aquí por dos
 * motivos: las pestañas son un pager con las tres páginas montadas a la vez,
 * así que habría tres copias de la ficha y el desplazamiento de una no movería
 * las otras; y la ficha se iría **entera**, dejando la pantalla sin decir de
 * quién es el perfil que estás leyendo.
 *
 * ## Cómo mide
 *
 * La altura desplegada **se mide, no se estima**: depende de si hay bio, de
 * cuántas líneas ocupe y de qué botón de relación toque pintar (uno, dos, o
 * ninguno si eres tú). Hasta que `onLayout` contesta, el contenedor va a altura
 * automática y no hay animación — es un fotograma, y es preferible a un salto
 * desde una altura inventada.
 */

export function CollapsingHeader({
  collapsed,
  range,
  expanded,
  compact,
}: {
  /** 1 recogida, 0 desplegada. Lo escriben las secciones. */
  collapsed: SharedValue<number>;
  /**
   * Cuánto espacio devuelve al recogerse, para que quien decide pueda mirar si
   * la lista puede permitírselo. Lo escribe esta cabecera al medirse.
   */
  range: SharedValue<number>;
  expanded: ReactNode;
  /** La barra que queda al recogerse. Debe caber en `COLLAPSED_HEIGHT`. */
  compact: ReactNode;
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
   * opacidad; hay que decírselo a React. Cruza **una vez por cambio de estado**,
   * que ahora son dos por gesto en vez de uno por fotograma.
   */
  const [folded, setFolded] = useState(false);
  useAnimatedReaction(
    () => collapsed.value > 0.5,
    (isFolded, wasFolded) => {
      if (isFolded !== wasFolded) runOnJS(setFolded)(isFolded);
    },
  );

  const measure = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // Con tolerancia: un `setState` por cada píxel de diferencia es un bucle de
    // renders, y las medidas de layout no son enteras.
    setFullHeight((current) => (Math.abs(current - height) < 1 ? current : height));
    range.value = Math.max(0, height - COLLAPSED_HEIGHT);
  };

  /**
   * El estado, suavizado hacia un destino **constante**.
   *
   * Esta es la línea que corta el bucle: `collapsed` solo vale 0 o 1, así que la
   * altura de abajo nunca depende de dónde esté el dedo. Un recorte del
   * desplazamiento a mitad de la animación cambia el desplazamiento y ya está.
   */
  const progress = useDerivedValue(() => withTiming(collapsed.value, { duration: 220 }));

  const containerStyle = useAnimatedStyle(() => {
    if (fullHeight === 0) return {};
    return { height: fullHeight - progress.value * (fullHeight - COLLAPSED_HEIGHT) };
  }, [fullHeight]);

  // Se apaga antes de que el contenedor termine de encogerse, o los últimos
  // píxeles serían la ficha recortada por la mitad en vez de desvanecida.
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value * 1.8),
  }));

  const compactStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, progress.value * 1.8 - 0.8),
  }));

  return (
    <Animated.View style={[{ overflow: 'hidden' }, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          compactStyle,
          { position: 'absolute', top: 0, left: 0, right: 0, height: COLLAPSED_HEIGHT },
        ]}
      >
        {compact}
      </Animated.View>

      <Animated.View pointerEvents={folded ? 'none' : 'auto'} style={expandedStyle}>
        <View onLayout={measure}>{expanded}</View>
      </Animated.View>
    </Animated.View>
  );
}
