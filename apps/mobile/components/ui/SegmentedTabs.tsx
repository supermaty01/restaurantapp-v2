import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { elevation } from '@/lib/design/tokens';

import { pageAfterSwipe, thumbGeometry, TRACK_PADDING } from './segmented-tabs-motion';
import { Txt } from './Txt';

import type { LayoutChangeEvent } from 'react-native';

export interface SegmentedTab {
  key: string;
  label: string;
  render: () => ReactNode;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  /** Pestaña inicial. Solo se lee al montar: para forzarla después, `selectedKey`. */
  initialKey?: string | undefined;
  /**
   * Pestaña impuesta desde fuera.
   *
   * Existe porque `initialKey` no bastaba: la pantalla del diario vive en una
   * pestaña que no se desmonta nunca, así que llegar a ella otra vez con otro
   * `?tab=` no volvía a montar nada y el parámetro se ignoraba. Las tarjetas de
   * inicio llevaban siempre a la última pestaña abierta.
   */
  selectedKey?: string | undefined;
  onSelect?: ((key: string) => void) | undefined;
  /**
   * Deslizar horizontalmente para cambiar de pestaña.
   *
   * Opcional y apagado por defecto. Solo tiene sentido donde las pestañas son
   * caras de una misma cosa y las recorres constantemente — el diario — y sería
   * un estorbo donde el contenido ya se arrastra en horizontal, como las tiras
   * de fotos o el detalle con carrusel.
   *
   * **Además decide cómo se monta el contenido**, que es la diferencia grande:
   * con pager las páginas existen todas a la vez; sin él, solo la activa.
   */
  swipeable?: boolean;
}

const SETTLE_SPRING = { damping: 22, stiffness: 220, mass: 0.7 };
const SELECT_SPRING = { damping: 26, stiffness: 300, mass: 0.6 };

/**
 * In-screen tab switcher.
 *
 * v1 used a material-top-tabs navigator for this, but these tabs are not routes
 * — they never appeared in the URL and carried no navigation state. A plain
 * component removes a banned dependency (expo-router forbids hand-rolled
 * react-navigation navigators since SDK 56) and is far less machinery.
 *
 * Rendered as a segmented control on a recessed track rather than as an
 * underline: an underline reads as page-level navigation, and these switch
 * content *within* a page, one level below the header that already uses one.
 *
 * ## Por qué el cambio de pestaña se sentía como una redirección
 *
 * Porque **lo era**. La versión anterior pintaba solo la activa
 * (`<View>{activeTab.render()}</View>`): no había tres páginas ni
 * desplazamiento, había un intercambio. El gesto Pan tampoco movía nada
 * mientras arrastrabas —solo miraba al soltar y llamaba a `go(±1)`— y el
 * indicador animaba la opacidad de cada segmento por separado, así que no había
 * ninguna pastilla deslizándose: había dos apareciendo y desapareciendo.
 *
 * Ahora, con `swipeable`, las páginas están todas montadas en una fila y el
 * gesto mueve un `translateX` compartido. La posición y la anchura de la
 * pastilla **se interpolan desde ese desplazamiento**, no desde el estado, que
 * es lo que hace que el indicador siga al dedo y que el efecto salga solo en
 * vez de tener que animarse aparte.
 *
 * El coste es real y va escrito: montar las tres páginas a la vez son tres
 * consultas vivas en vez de una. Es lo que cuesta que el gesto tenga algo que
 * mover, y por eso `swipeable` sigue siendo opcional — en el detalle de un
 * restaurante, donde las pestañas se visitan de una en una, no compensa.
 */
export function SegmentedTabs({
  tabs,
  initialKey,
  selectedKey,
  onSelect,
  swipeable = false,
}: SegmentedTabsProps) {
  const [internalKey, setInternalKey] = useState(initialKey ?? tabs[0]?.key ?? '');

  // Controlado si el padre manda una pestaña; si no, se gobierna solo.
  const activeKey = selectedKey ?? internalKey;
  const setActiveKey = (key: string) => {
    setInternalKey(key);
    onSelect?.(key);
  };

  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.key === activeKey),
    0,
  );
  const activeTab = tabs[activeIndex];

  /*
   * Se mide, no se estima.
   *
   * El ancho de una página es el del contenedor, no el de la ventana: esta
   * pantalla vive dentro de un `SafeAreaView` con insets laterales, así que
   * `useWindowDimensions` deja cada página unos píxeles descolocada y el error
   * se acumula página a página. Es la lección que costó dos pasadas en el
   * scroll del calendario.
   */
  const [pageWidth, setPageWidth] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  /** Desplazamiento del pager, en píxeles y negativo hacia la derecha. */
  const offset = useSharedValue(0);
  const dragStart = useSharedValue(0);

  /** Lo mismo en unidades de página: 1.5 es «a mitad entre la 1 y la 2». */
  const position = useDerivedValue(() => (pageWidth > 0 ? -offset.value / pageWidth : activeIndex));

  /*
   * Un cambio que no viene del dedo —un toque en un segmento, o un `?tab=`
   * desde Inicio— también tiene que mover el pager.
   */
  useAnimatedReaction(
    () => ({ index: activeIndex, width: pageWidth }),
    (current, previous) => {
      if (current.width === 0) return;
      const target = -current.index * current.width;
      if (previous && previous.index === current.index && previous.width === current.width) return;
      // Sin animación si lo que cambió es el ancho (una rotación): ahí no hay
      // nada que contar, solo hay que estar en el sitio correcto.
      offset.value =
        previous && previous.width !== current.width ? target : withSpring(target, SETTLE_SPRING);
    },
    [activeIndex, pageWidth],
  );

  /**
   * Un desplazamiento horizontal claro cambia de pestaña.
   *
   * `activeOffsetX` es lo que evita robarle el gesto a las listas verticales:
   * hasta que el dedo no lleva 20 px en horizontal, el gesto no se activa y el
   * scroll manda. `failOffsetY` lo remata — si se va en vertical primero, esto
   * se rinde.
   */
  const swipe = Gesture.Pan()
    .enabled(swipeable && pageWidth > 0)
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      dragStart.value = offset.value;
    })
    .onUpdate((event) => {
      // Con topes: más allá de la primera y la última no hay nada que enseñar,
      // y dejar arrastrar hasta el vacío es lo que hace que un pager casero se
      // note casero.
      const min = -(tabs.length - 1) * pageWidth;
      offset.value = Math.min(0, Math.max(min, dragStart.value + event.translationX));
    })
    .onEnd((event) => {
      const from = Math.round(-dragStart.value / pageWidth);
      const next = pageAfterSwipe({
        from,
        translationX: event.translationX,
        velocityX: event.velocityX,
        count: tabs.length,
      });

      offset.value = withSpring(-next * pageWidth, SETTLE_SPRING);

      // Solo si cambia: avisar del mismo índice hace que el padre reescriba su
      // estado y el `?tab=` en cada arrastre que se queda a medias.
      const key = tabs[next]?.key;
      if (key !== undefined && next !== from) runOnJS(setActiveKey)(key);
    });

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const measurePage = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setPageWidth((current) => (Math.abs(current - width) < 1 ? current : width));
  };

  const measureTrack = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setTrackWidth((current) => (Math.abs(current - width) < 1 ? current : width));
  };

  return (
    <View className="flex-1">
      <View className="mx-5 my-3 flex-row rounded-pill bg-sunken p-1" onLayout={measureTrack}>
        {/* La pastilla es **una**, compartida, y se mueve con el pager. Antes
            había una por segmento animando su opacidad, que es por lo que no
            se deslizaba nada. */}
        {swipeable && trackWidth > 0 ? (
          <Thumb count={tabs.length} trackWidth={trackWidth} position={position} />
        ) : null}
        {tabs.map((tab, index) => (
          <Segment
            key={tab.key}
            label={tab.label}
            selected={index === activeIndex}
            standalone={!swipeable}
            onPress={() => setActiveKey(tab.key)}
          />
        ))}
      </View>

      {swipeable ? (
        <GestureDetector gesture={swipe}>
          <View className="flex-1 overflow-hidden" onLayout={measurePage}>
            <Animated.View
              style={[
                { flex: 1, flexDirection: 'row', width: pageWidth * tabs.length },
                pagerStyle,
              ]}
            >
              {tabs.map((tab) => (
                <View key={tab.key} style={{ width: pageWidth }}>
                  {/* Sin ancho todavía no hay dónde pintar, y montar las listas
                      para medirlas después las haría consultar dos veces. */}
                  {pageWidth > 0 ? tab.render() : null}
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      ) : (
        <View className="flex-1">{activeTab?.render()}</View>
      )}
    </View>
  );
}

/**
 * La pastilla que sigue al dedo.
 *
 * Se estira a mitad de camino y se recoge al llegar — el «efecto gota». La
 * anchura sale de la parte fraccionaria de la posición, así que el estirón
 * ocurre donde está el dedo y no en un tiempo fijo: si te paras a medio
 * arrastre, se queda estirada.
 */
function Thumb({
  count,
  trackWidth,
  position,
}: {
  count: number;
  trackWidth: number;
  position: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const { left, width } = thumbGeometry({ position: position.value, count, trackWidth });
    return { width, transform: [{ translateX: left }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        elevation.low,
        { position: 'absolute', top: TRACK_PADDING, bottom: TRACK_PADDING, left: 0 },
      ]}
      className="rounded-pill bg-surface"
    />
  );
}

function Segment({
  label,
  selected,
  standalone,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Sin pager no hay pastilla compartida que seguir, así que cada uno pinta la suya. */
  standalone: boolean;
  onPress: () => void;
}) {
  const progress = useDerivedValue(() => withSpring(selected ? 1 : 0, SELECT_SPRING), [selected]);

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className="flex-1 items-center justify-center py-2"
    >
      {standalone ? (
        <Animated.View
          pointerEvents="none"
          style={[thumbStyle, selected ? elevation.low : undefined]}
          className="absolute inset-0 rounded-pill bg-surface"
        />
      ) : null}
      <Txt
        variant="callout"
        serif={false}
        weight={selected ? 'bold' : 'semi'}
        tone={selected ? 'ink' : 'subtle'}
        numberOfLines={1}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
