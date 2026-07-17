import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ZoomableImage } from './ZoomableImage';

/** Vertical drag past this many points dismisses the lightbox. */
const DISMISS_THRESHOLD = 120;

export interface LightboxImage {
  id: string | number;
  uri: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/**
 * Full-screen image viewer: swipe between images, pinch/double-tap to zoom,
 * drag down to dismiss.
 *
 * Paging uses a plain FlatList (native, reliable) instead of a pager library;
 * zoom and dismiss are our own gestures. See docs/11-dependencias.md for why
 * this is hand-written.
 */
export function ImageLightbox({ images, initialIndex, visible, onClose }: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const listRef = useRef<FlatList<LightboxImage>>(null);

  const translateY = useSharedValue(0);

  const handleClose = useCallback(() => {
    translateY.value = 0;
    setIsZoomed(false);
    onClose();
  }, [onClose, translateY]);

  // Vertical-only pan: activeOffsetY lets the horizontal FlatList win side swipes.
  const dismissGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-20, 20])
    .enabled(!isZoomed)
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) > DISMISS_THRESHOLD) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Backdrop fades out as the image is dragged away, so the gesture feels physical.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateY.value), [0, DISMISS_THRESHOLD * 2], [1, 0.3], 'clamp'),
  }));

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(next);
    },
    [width],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<LightboxImage>) => (
      <ZoomableImage uri={item.uri} width={width} height={height} onZoomChange={setIsZoomed} />
    ),
    [width, height],
  );

  const keyExtractor = useCallback((item: LightboxImage) => String(item.id), []);

  const getItemLayout = useCallback(
    (_: ArrayLike<LightboxImage> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={dismissGesture}>
        <Animated.View style={[styles.container, containerStyle]}>
          <FlatList
            ref={listRef}
            data={images}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            windowSize={3}
          />
        </Animated.View>
      </GestureDetector>

      <Pressable
        onPress={handleClose}
        style={styles.closeButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar imagen"
      >
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </Pressable>

      {images.length > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {index + 1} / {images.length}
          </Text>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  counter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
