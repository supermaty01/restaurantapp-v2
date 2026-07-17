import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ImageLightbox, type LightboxImage } from './ImageLightbox';

const CAROUSEL_HEIGHT = 224;

interface ImageCarouselProps {
  images: LightboxImage[];
  height?: number;
}

/**
 * Paged image carousel with dot indicators; tapping an image opens the lightbox.
 *
 * Dependency-free by design (RN core + expo-image): see docs/11-dependencias.md.
 */
export function ImageCarousel({ images, height = CAROUSEL_HEIGHT }: ImageCarouselProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<LightboxImage>) => (
      <Pressable
        onPress={() => setLightboxIndex(index)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Ver imagen ${index + 1} de ${images.length}`}
      >
        <Image
          source={item.uri}
          style={{ width, height }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          recyclingKey={`carousel-${item.id}`}
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    ),
    [width, height, images.length],
  );

  const keyExtractor = useCallback((item: LightboxImage) => String(item.id), []);

  const getItemLayout = useCallback(
    (_: ArrayLike<LightboxImage> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  if (images.length === 0) {
    return (
      <View
        className="bg-gray-400 dark:bg-gray-700 justify-center items-center"
        style={{ width, height }}
      >
        <Text className="text-white">Sin imágenes</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={images}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        windowSize={3}
      />

      {images.length > 1 && (
        <View className="flex-row justify-center items-center my-2">
          {images.map((image, index) => (
            <View
              key={image.id}
              className={`w-2 h-2 rounded-full mx-1 ${
                activeIndex === index ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </View>
      )}

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}
