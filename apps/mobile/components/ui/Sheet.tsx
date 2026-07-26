import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';

import { Txt } from './Txt';

import type { ReactNode } from 'react';

/**
 * A bottom sheet.
 *
 * Every panel in the app used to build its own: a `Modal` with a hand-rolled
 * backdrop, its own corner radius and its own idea of where the title goes.
 * This is the one implementation.
 *
 * The `GestureHandlerRootView` is load-bearing, not decoration — a React Native
 * `Modal` renders into its own native view hierarchy, outside the root that
 * gesture-handler attaches to, so any gesture declared inside a sheet without it
 * is silently inert. That cost us the image viewer's pinch-zoom once already
 * (docs/14); `components/modal-gestures.node.test.ts` now guards it.
 *
 * ## Por qué la animación no la lleva `entering`/`exiting`
 *
 * Antes sí: `SlideInDown` para entrar, `SlideOutDown` para salir, y el arrastre
 * por separado en su propio valor. Tres cosas moviendo la misma hoja sin
 * hablarse, y de ahí salía el parpadeo al deslizar hacia abajo:
 *
 * 1. arrastrabas la hoja hasta media pantalla,
 * 2. al soltar, el gesto **devolvía la hoja a su sitio** (`dragY = 0`) y
 *    llamaba a `onClose()`,
 * 3. y solo entonces empezaba `SlideOutDown`, desde arriba.
 *
 * O sea que la hoja daba un salto hacia arriba —un fotograma completo, bien
 * visible— antes de caer. Encima `exiting` sobre un `Modal` cuyo `visible` pasa
 * a `false` es una carrera que a veces ni se ve: React Native desmonta la
 * ventana nativa sin esperar a nadie.
 *
 * Ahora hay **un solo valor** (`translateY`) y la hoja nunca se teletransporta:
 * el arrastre lo mueve, soltar lo continúa hasta abajo, y el desmontaje ocurre
 * cuando la animación termina y no antes. El fondo oscuro se aclara con la
 * misma cuenta, así que arrastrar hacia abajo va destapando la pantalla en vez
 * de apagarse de golpe al final.
 */

/**
 * Cómo llega la hoja.
 *
 * Amortiguado sin rebote a propósito: una hoja que se pasa y vuelve se lee como
 * un temblor, no como física. Tiene que llegar y quedarse.
 */
const OPEN_SPRING = {
  damping: 26,
  stiffness: 260,
  mass: 0.75,
  overshootClamping: true,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 2,
};

/** Cómo se va cuando la cierra otro (la X, el fondo, el botón de volver). */
const CLOSE_TIMING = { duration: 200, easing: Easing.in(Easing.cubic) };

/**
 * Cómo se va cuando la sueltas tú.
 *
 * Muelle y no tiempo fijo, porque hereda la velocidad del dedo: soltar de un
 * golpe seco la manda abajo deprisa y arrastrarla despacio la acompaña. Con una
 * duración fija las dos tardan lo mismo y el gesto se siente desconectado.
 */
const FLING_SPRING = { damping: 40, stiffness: 320, mass: 0.7, overshootClamping: true };

/** Cuánto hay que bajarla para que soltar signifique cerrar. */
const CLOSE_FRACTION = 0.28;

/** Un empujón rápido cuenta aunque haya recorrido poco. */
const FLING_VELOCITY = 700;

/**
 * Cuánto tiene que moverse el dedo antes de que el arrastre se active.
 *
 * Sin este margen el gesto se queda con cualquier toque que caiga en la
 * cabecera y la X deja de responder, que es exactamente el fallo que estos
 * paneles han tenido desde el principio.
 */
const DRAG_SLOP = 12;

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  /** Caps the body height as a fraction of the screen, so long lists scroll. */
  maxHeightRatio = 0.85,
}: {
  /**
   * Controlada por quien la usa: `onClose` **tiene** que acabar poniendo esto a
   * `false`.
   *
   * No es una formalidad. La hoja sigue montada mientras baja —si no, no habría
   * nada que animar— y es el paso a `false` lo que cierra el ciclo. Un
   * `<Sheet visible>` fijo, escondiendo el panel desmontando al padre, se salta
   * la animación de salida entera: desaparece de golpe.
   */
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeightRatio?: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  /*
   * El montaje lo lleva la hoja, no `visible`.
   *
   * Si la ventana nativa desapareciera en cuanto `visible` pasa a `false` no
   * habría nada que animar: la hoja se esfumaría y el gesto de arrastrar hacia
   * abajo no tendría salida. Así que `visible` **pide** cerrar y el desmontaje
   * espera a que la animación llegue al final.
   */
  const [mounted, setMounted] = useState(visible);

  /*
   * Quién cede espacio cuando no cabe todo.
   *
   * Antes el tope vivía en la tarjeta y el cuerpo llevaba `flexShrink: 1`, con
   * la idea de que encogiera él. No lo hacía: el cuerpo suele ser un
   * `ScrollView`, cuya altura la fija su contenido, así que quien acababa
   * cediendo era el pie. Medido en el panel de filtros: la tarjeta cortaba en
   * y=2211 y los botones "Limpiar"/"Aplicar" quedaban de 51px en vez de 102 —
   * partidos por la mitad y, con menos sitio o una fuente más grande, reducidos
   * a nada. Ese es el motivo real de que los paneles parecieran no responder.
   *
   * Ahora el tope lo lleva el cuerpo, que es lo único que sabe desplazarse. La
   * cabecera y el pie se miden y se restan, así que su altura está garantizada
   * y no hay reparto que negociar.
   */
  const [chromeHeight, setChromeHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  const bottomPad = Math.max(insets.bottom, 12);
  const bodyMaxHeight = Math.max(
    // Un suelo para que el cuerpo no desaparezca antes de la primera medida.
    160,
    windowHeight * maxHeightRatio - chromeHeight - footerHeight - bottomPad,
  );

  /** Dónde está la hoja: 0 es abierta del todo, `sheetHeight` es fuera de la pantalla. */
  const translateY = useSharedValue(windowHeight);
  const sheetHeight = useSharedValue(windowHeight);
  /** Dónde estaba al empezar el arrastre. */
  const dragOrigin = useSharedValue(0);
  /** Si la animación de entrada ya se lanzó para este montaje. */
  const entered = useRef(false);

  /*
   * Lo que `visible` dice *ahora*, legible desde el final de una animación.
   *
   * Una animación de cierre tarda dos décimas, y en ese rato se puede volver a
   * pedir que se abra. Sin esta comprobación al final, la hoja se desmontaría
   * después de haber vuelto a subir: en pantalla, abrirla y que desaparezca
   * sola.
   */
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (!visible) return;
    if (!mounted) {
      setMounted(true);
      return;
    }
    // Ya estaba montada: la están reabriendo mientras caía. Vuelve a subir
    // desde donde esté, sin saltos.
    if (entered.current) translateY.value = withSpring(0, OPEN_SPRING);
  }, [visible, mounted, translateY]);

  const finishClose = useCallback(() => {
    if (visibleRef.current) return;
    setMounted(false);
  }, []);

  // Cerrar desde fuera: la X, el fondo, el botón de volver de Android, o un
  // padre que decide esconderla. Baja desde donde esté y desmonta al terminar.
  useEffect(() => {
    if (visible || !mounted) return;
    translateY.value = withTiming(sheetHeight.value, CLOSE_TIMING, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [visible, mounted, translateY, sheetHeight, finishClose]);

  // Desmontada, todo vuelve al punto de partida para la próxima apertura. Sin
  // esto la hoja reaparecería ya abierta y sin animación.
  useEffect(() => {
    if (mounted) return;
    entered.current = false;
    translateY.value = windowHeight;
  }, [mounted, translateY, windowHeight]);

  /*
   * La entrada arranca al medir, no al montar.
   *
   * Es la única forma de saber cuánto mide la hoja, y sin ese dato la animación
   * tendría que recorrer la pantalla entera: la misma distancia para un panel de
   * tres opciones que para uno a pantalla completa, o sea velocidades distintas
   * para cosas que deberían sentirse igual. Hasta la primera medida está en
   * `windowHeight`, que es fuera de la pantalla, así que no hay ningún
   * fotograma en el que se la vea fuera de sitio.
   */
  const measure = useCallback(
    (height: number) => {
      if (height <= 0) return;
      sheetHeight.value = height;
      if (entered.current) return;
      entered.current = true;
      translateY.value = height;
      translateY.value = withSpring(0, OPEN_SPRING);
    },
    [sheetHeight, translateY],
  );

  // Se llama al terminar de caer por el gesto. Desmonta primero y avisa después:
  // al revés, el efecto de cierre volvería a animar una hoja que ya está abajo.
  const settleClosed = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const dragToClose = Gesture.Pan()
    // Solo se activa tras `DRAG_SLOP` píxeles verticales, para que un toque en
    // la cabecera siga siendo un toque.
    .activeOffsetY([-DRAG_SLOP, DRAG_SLOP])
    .onStart(() => {
      dragOrigin.value = translateY.value;
    })
    .onUpdate((event) => {
      // Solo hacia abajo: tirar hacia arriba no significa nada y estirar el
      // panel por encima de su sitio se ve como un fallo.
      translateY.value = Math.max(dragOrigin.value + event.translationY, 0);
    })
    .onEnd((event) => {
      const farEnough = translateY.value > sheetHeight.value * CLOSE_FRACTION;
      const flung = event.velocityY > FLING_VELOCITY;

      if (farEnough || flung) {
        translateY.value = withSpring(
          sheetHeight.value,
          { ...FLING_SPRING, velocity: event.velocityY },
          (finished) => {
            if (finished) runOnJS(settleClosed)();
          },
        );
        return;
      }

      translateY.value = withSpring(0, OPEN_SPRING);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /*
   * El fondo se aclara con la hoja, no aparte.
   *
   * Antes iba con `FadeIn`/`FadeOut` por su cuenta, así que arrastrar la hoja
   * hasta media pantalla dejaba la oscuridad intacta y luego se apagaba de
   * golpe. Atado al mismo valor, el gesto va destapando lo que hay debajo y se
   * ve a dónde vas a volver antes de soltar.
   */
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, Math.max(sheetHeight.value, 1)],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      // Las dos juntas: sin `statusBarTranslucent` la ventana del modal se mete
      // dentro de los insets y la hoja deja de tocar el borde de abajo, que es
      // lo que dejó a este panel flotando en medio de la pantalla durante meses.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={{ backgroundColor: 'rgba(26, 21, 18, 0.45)' }}
            className="h-full w-full"
          />
        </Animated.View>

        <Animated.View
          onLayout={(event) => measure(event.nativeEvent.layout.height)}
          style={[
            elevation.high,
            cardStyle,
            {
              backgroundColor: colors.surface,
              // Pegada al borde de abajo: una hoja que sale *desde abajo* y se
              // queda a diez píxeles del borde parece que se ha quedado a
              // medio camino. El hueco de la barra de navegación lo cubre el
              // relleno, no un margen.
              paddingBottom: bottomPad,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
            },
          ]}
        >
          {/* El gesto vive en la cabecera entera, no solo en la muesca: apuntar
              a una barra de cuatro píxeles de alto es pedir puntería para algo
              que debería salir solo. No baja al cuerpo porque ahí dentro hay
              listas y campos que se desplazan, y un pan por encima les robaría
              el gesto. */}
          <GestureDetector gesture={dragToClose}>
            <View onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}>
              <View className="items-center pb-1 pt-2.5">
                <View className="h-1 w-10 rounded-pill bg-line-strong" />
              </View>

              {title ? (
                <View className="flex-row items-start justify-between gap-3 px-5 pb-3 pt-2">
                  <View className="min-w-0 flex-1">
                    <Txt variant="title">{title}</Txt>
                    {subtitle ? (
                      <Txt variant="caption" tone="subtle" className="mt-0.5">
                        {subtitle}
                      </Txt>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    hitSlop={10}
                    className="h-8 w-8 items-center justify-center rounded-pill bg-sunken"
                  >
                    <Ionicons name="close" size={17} color={colors.inkMuted} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </GestureDetector>

          {/* El único que cede: lleva el tope y sabe desplazarse. */}
          <View style={{ maxHeight: bodyMaxHeight }}>{children}</View>

          {footer ? (
            <View
              className="border-t border-line px-5 pt-3"
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
