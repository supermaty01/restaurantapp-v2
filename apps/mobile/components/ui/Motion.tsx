import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quick and barely springy: felt, not watched. */
const PRESS_SPRING = { damping: 26, stiffness: 380, mass: 0.5 };

/**
 * A pressable that yields under the finger.
 *
 * `active:opacity-80` is the cheap version of this and it reads as a flicker.
 * A small scale plus a spring back is what makes a card feel like an object
 * rather than a rectangle that changes colour.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  scaleTo = 0.97,
  className = '',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  disabled?: boolean | undefined;
  scaleTo?: number;
  className?: string;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      disabled={disabled || !onPress}
      onPress={onPress}
      {...(onLongPress ? { onLongPress } : {})}
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      className={className}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Fades and lifts its children into place.
 *
 * Used to stagger list rows and the blocks of a dashboard, so a screen arrives
 * rather than appearing. `index` spaces the delays; anything past the first
 * handful lands together, because a long list would otherwise spend a visible
 * second assembling itself.
 */
export function FadeInUp({
  children,
  index = 0,
  distance = 12,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  distance?: number;
  className?: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = Math.min(index, 6) * 45;
    progress.value = withDelay(delay, withTiming(1, { duration: 320 }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [distance, 0]) }],
  }));

  return (
    <Animated.View className={className} style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
