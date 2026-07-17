import { Image } from 'expo-image';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /** Notifies the pager so it can disable horizontal paging while zoomed in. */
  onZoomChange?: ((isZoomed: boolean) => void) | undefined;
}

/**
 * A single pinch/double-tap zoomable image.
 *
 * Written in-house on top of gesture-handler + reanimated (both already part of
 * the Expo base stack) rather than pulling a zoom library: image libraries were
 * historically what broke every SDK upgrade. See docs/11-dependencias.md.
 */
export function ZoomableImage({ uri, width, height, onZoomChange }: ZoomableImageProps) {
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const notifyZoom = useCallback(
    (isZoomed: boolean) => {
      onZoomChange?.(isZoomed);
    },
    [onZoomChange],
  );

  /**
   * Keeps the image from being panned past its own edges. At scale s the image
   * overflows the viewport by (s-1)/2 of its size on each axis; that overflow is
   * exactly how far it may travel.
   */
  const clampTranslation = useCallback((value: number, axisSize: number, currentScale: number) => {
    'worklet';
    const maxOffset = Math.max(0, (axisSize * currentScale - axisSize) / 2);
    return Math.min(Math.max(value, -maxOffset), maxOffset);
  }, []);

  const reset = useCallback(() => {
    'worklet';
    scale.value = withTiming(MIN_SCALE);
    savedScale.value = MIN_SCALE;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(notifyZoom)(false);
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, notifyZoom]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE * 0.8), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      translateX.value = clampTranslation(translateX.value, width, scale.value);
      translateY.value = clampTranslation(translateY.value, height, scale.value);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(notifyZoom)(true);
    });

  // Only pans while zoomed in; at scale 1 the pager/dismiss gestures own the drag.
  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((event) => {
      if (scale.value <= MIN_SCALE) return;
      translateX.value = clampTranslation(
        savedTranslateX.value + event.translationX,
        width,
        scale.value,
      );
      translateY.value = clampTranslation(
        savedTranslateY.value + event.translationY,
        height,
        scale.value,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > MIN_SCALE) {
        reset();
        return;
      }
      // Zoom toward the tapped point rather than the centre.
      const focalX = event.x - width / 2;
      const focalY = event.y - height / 2;
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      savedScale.value = DOUBLE_TAP_SCALE;
      const targetX = clampTranslation(-focalX * (DOUBLE_TAP_SCALE - 1), width, DOUBLE_TAP_SCALE);
      const targetY = clampTranslation(-focalY * (DOUBLE_TAP_SCALE - 1), height, DOUBLE_TAP_SCALE);
      translateX.value = withTiming(targetX);
      translateY.value = withTiming(targetY);
      savedTranslateX.value = targetX;
      savedTranslateY.value = targetY;
      runOnJS(notifyZoom)(true);
    });

  const composed = Gesture.Simultaneous(Gesture.Race(doubleTap, pan), pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height }, styles.container]}>
        <Animated.View style={animatedStyle}>
          <Image
            source={uri}
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
