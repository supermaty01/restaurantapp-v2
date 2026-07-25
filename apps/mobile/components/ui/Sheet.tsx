import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      // Without these the modal stops at the system bars on Android, leaving a
      // strip of the app visible under the sheet instead of the sheet sitting
      // on the bottom edge.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
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
            {
              backgroundColor: colors.surface,
              maxHeight: `${maxHeightRatio * 100}%`,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          className="absolute inset-x-0 bottom-0 rounded-t-[26px]"
        >
          {/* Grab handle: says "this came from the bottom and goes back there". */}
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

          {children}

          {footer ? <View className="border-t border-line px-5 pt-3">{footer}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
