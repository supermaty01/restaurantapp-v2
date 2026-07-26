import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
 */
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

  // Cuánto se ha arrastrado la hoja hacia abajo.
  const dragY = useSharedValue(0);

  const dismiss = () => {
    dragY.value = 0;
    onClose();
  };

  const dragToClose = Gesture.Pan()
    .onUpdate((event) => {
      // Solo hacia abajo: tirar hacia arriba no significa nada y estirar el
      // panel por encima de su sitio se ve como un fallo.
      dragY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      // Un empujón rápido cuenta aunque haya recorrido poco: es lo que hace que
      // el gesto se sienta como soltar algo y no como arrastrarlo hasta el
      // final.
      const flung = event.velocityY > 800;
      if (flung || dragY.value > 90) {
        runOnJS(dismiss)();
        return;
      }
      dragY.value = withSpring(0, { damping: 30, stiffness: 260, mass: 0.9 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={{ backgroundColor: 'rgba(26, 21, 18, 0.45)' }}
            className="h-full w-full"
          />
        </Animated.View>

        <Animated.View
          // Well damped on purpose: a sheet that overshoots and settles reads
          // as wobble, not as physics. It should arrive and stay put.
          entering={SlideInDown.springify().damping(30).stiffness(260).mass(0.9)}
          exiting={SlideOutDown.duration(180)}
          style={[
            elevation.high,
            dragStyle,
            {
              backgroundColor: colors.surface,
              maxHeight: `${maxHeightRatio * 100}%`,
              paddingBottom: 14,
              marginHorizontal: 10,
              marginBottom: Math.max(insets.bottom, 10),
            },
          ]}
          // Rounded on all four corners and inset from the edges. Making a
          // modal sit flush against Android's navigation bar meant fighting the
          // inset system, and it broke the layout twice; a card that floats
          // deliberately reads better than one that almost reaches the edge.
          className="rounded-[26px]"
        >
          {/* La muesca no es decoración: es la zona de agarre.
              El gesto vive solo aquí, no en toda la hoja, porque dentro hay
              listas y campos que scrollean — un pan sobre todo el panel les
              robaría el gesto y haría imposible desplazar el contenido. */}
          <GestureDetector gesture={dragToClose}>
            <View className="items-center pb-1 pt-2.5" style={{ paddingHorizontal: 60 }}>
              <View className="h-1 w-10 rounded-pill bg-line-strong" />
            </View>
          </GestureDetector>

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

          {/* flexShrink: el cuerpo cede espacio antes que el pie. Sin esto, un
              contenido más alto que `maxHeightRatio` empujaba los botones fuera
              del panel: en el de filtros, "Limpiar" y "Aplicar" quedaban
              literalmente por debajo del borde. */}
          <View style={{ flexShrink: 1 }}>{children}</View>

          {footer ? (
            <View className="border-t border-line px-5 pt-3" style={{ flexShrink: 0 }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
