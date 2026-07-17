import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View, Text } from 'react-native';

import { PeekPreviewData } from '@/components/peek/types';
import PeekablePressable from '@/components/PeekablePressable';
import RatingStars from '@/components/RatingStars';
import { ImageDTO } from '@/features/images/types/image-dto';
import Tag from '@/features/tags/components/Tag';
import { TagDTO } from '@/features/tags/types/tag-dto';

interface DishItemProps {
  name: string;
  comments: string | null;
  tags: TagDTO[];
  rating: number | null;
  images: ImageDTO[];
  previewData: PeekPreviewData;
  onPress?: () => void;
}

const DishItem = React.memo<DishItemProps>(({
  name,
  comments,
  tags,
  rating,
  images,
  previewData,
  onPress,
}) => {
  const imageUrl = images.length > 0 ? images[0].uri : null;

  return (
    <PeekablePressable
      previewData={previewData}
      onPress={onPress}
      scaleValue={1.03}
      className="bg-card dark:bg-dark-card p-4 rounded-xl mb-4 shadow-sm"
    >
      <View className="flex-row mb-2">
        {imageUrl ? (
          <Image
            source={imageUrl}
            style={{ width: 64, height: 64, borderRadius: 8 }}
            contentFit="cover"
            recyclingKey={`dish-${imageUrl}`}
            cachePolicy="memory-disk"
          />
        ) : null}
        <View className={`flex-1 ${imageUrl ? 'ml-3' : ''}`}>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-800 dark:text-gray-200 max-w-[85%]">
              {name}
            </Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#6b6b6b" />
          </View>
          {comments ? (
            <Text className="text-sm text-gray-600 dark:text-gray-300 mb-1" numberOfLines={2}>
              {comments}
            </Text>
          ) : (
            <Text className="text-sm italic text-gray-600 dark:text-gray-300 mb-1">
              Sin comentarios
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row flex-wrap mb-2">
        {tags.map((tag) => (
          <Tag key={tag.id} color={tag.color} name={tag.name} />
        ))}
      </View>
      <View className="flex-row justify-end">
        <RatingStars value={rating} size={18} gap={2} readOnly />
      </View>
    </PeekablePressable>
  );
});

DishItem.displayName = 'DishItem';

export default DishItem;
