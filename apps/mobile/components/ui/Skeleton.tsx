import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { ViewStyle } from 'react-native';

/**
 * A placeholder block that breathes.
 *
 * A centred spinner tells you the app is busy; a skeleton tells you what is
 * about to be there, and the screen doesn't jump when it arrives. Used wherever
 * the shape of the result is known in advance — which is every list in the app.
 */
export function Skeleton({
  width,
  height = 14,
  radius = 8,
  className = '',
  style,
  delay = 0,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  className?: string;
  style?: ViewStyle;
  delay?: number;
}) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 + delay }),
        withTiming(0.5, { duration: 700 + delay }),
      ),
      -1,
      true,
    );
  }, [pulse, delay]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      className={`bg-sunken ${className}`}
      style={[{ width, height, borderRadius: radius }, animatedStyle, style]}
    />
  );
}

/** The skeleton of a list row: thumbnail, title, one line of metadata. */
export function SkeletonRow({ index = 0 }: { index?: number }) {
  return (
    <View className="mb-3 flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      <Skeleton width={66} height={66} radius={11} delay={index * 60} />
      <View className="flex-1 gap-2">
        <Skeleton width="70%" height={15} delay={index * 60} />
        <Skeleton width="45%" height={12} delay={index * 60} />
      </View>
    </View>
  );
}

/** A screenful of row skeletons, for a list that has not resolved yet. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </View>
  );
}
