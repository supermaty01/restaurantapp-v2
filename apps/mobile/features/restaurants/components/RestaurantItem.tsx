import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View, Text } from 'react-native';

import { PeekPreviewData } from '@/components/peek/types';
import PeekablePressable from '@/components/PeekablePressable';
import RatingStars from '@/components/RatingStars';
import Tag from '@/features/tags/components/Tag';
import { TagDTO } from '@/features/tags/types/tag-dto';
import { imagePathToUri } from '@/lib/helpers/image-paths';

interface RestaurantItemProps {
  name: string;
  comments: string | null;
  tags: TagDTO[];
  rating: number | null;
  imageUrl?: string;
  previewData: PeekPreviewData;
  onPress?: () => void;
}

const RestaurantItem = React.memo<RestaurantItemProps>(({
  name,
  comments,
  tags,
  rating,
  imageUrl,
  previewData,
  onPress,
}) => {
  const normalizedImageUrl = imageUrl ? imagePathToUri(imageUrl) : undefined;

  return (
    <PeekablePressable
      previewData={previewData}
      onPress={onPress}
      scaleValue={1.03}
      className="bg-card dark:bg-dark-card p-4 rounded-xl mb-4 shadow-sm"
    >
      <View className="flex-row mb-2">
        {normalizedImageUrl ? (
          <Image
            source={normalizedImageUrl}
            style={{ width: 64, height: 64, borderRadius: 8 }}
            contentFit="cover"
            recyclingKey={`restaurant-${normalizedImageUrl}`}
            cachePolicy="memory-disk"
          />
        ) : null}
        <View className={`flex-1 ${normalizedImageUrl ? 'ml-3' : ''}`}>
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

RestaurantItem.displayName = 'RestaurantItem';

export default RestaurantItem;
