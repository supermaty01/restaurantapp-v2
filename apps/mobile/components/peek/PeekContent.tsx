import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import Tag from '@/features/tags/components/Tag';
import { useTheme } from '@/lib/context/ThemeContext';

import { PeekPreviewData } from './types';

interface PeekContentProps {
  data: PeekPreviewData;
}

function RestaurantPeekContent({ data }: { data: Extract<PeekPreviewData, { type: 'restaurant' }> }) {
  return (
    <>
      {data.imageUrl ? (
        <View className="w-full rounded-lg mb-3 overflow-hidden bg-black/10">
          <Image
            source={data.imageUrl}
            style={{ width: '100%', aspectRatio: 4 / 3 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
      <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
        {data.name}
      </Text>
      {data.rating !== null ? (
        <View className="flex-row items-center mb-2">
          <RatingStars value={data.rating} size={18} gap={2} readOnly />
        </View>
      ) : null}
      {data.tags.length > 0 ? (
        <View className="flex-row flex-wrap mb-2">
          {data.tags.map((tag) => (
            <Tag key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </View>
      ) : null}
      {data.comments ? (
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {data.comments}
        </Text>
      ) : null}
    </>
  );
}

function DishPeekContent({ data }: { data: Extract<PeekPreviewData, { type: 'dish' }> }) {
  return (
    <>
      {data.imageUrl ? (
        <View className="w-full rounded-lg mb-3 overflow-hidden bg-black/10">
          <Image
            source={data.imageUrl}
            style={{ width: '100%', aspectRatio: 4 / 3 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
      <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
        {data.name}
      </Text>
      {data.rating !== null ? (
        <View className="flex-row items-center mb-2">
          <RatingStars value={data.rating} size={18} gap={2} readOnly />
        </View>
      ) : null}
      {data.tags.length > 0 ? (
        <View className="flex-row flex-wrap mb-2">
          {data.tags.map((tag) => (
            <Tag key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </View>
      ) : null}
      {data.comments ? (
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {data.comments}
        </Text>
      ) : null}
    </>
  );
}

function VisitPeekContent({ data }: { data: Extract<PeekPreviewData, { type: 'visit' }> }) {
  const { isDarkMode } = useTheme();

  return (
    <>
      {data.imageUrl ? (
        <View className="w-full rounded-lg mb-3 overflow-hidden bg-black/10">
          <Image
            source={data.imageUrl}
            style={{ width: '100%', aspectRatio: 4 / 3 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
      <Text className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
        {data.date}
      </Text>
      <View className="flex-row items-center mb-2">
        <Ionicons name="restaurant-outline" size={14} color={isDarkMode ? '#aaa' : '#666'} />
        <Text className="text-sm text-gray-600 dark:text-gray-400 ml-1">
          {data.restaurantName}
        </Text>
      </View>
      {data.comments ? (
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {data.comments}
        </Text>
      ) : null}
    </>
  );
}

export default function PeekContent({ data }: PeekContentProps) {
  switch (data.type) {
    case 'restaurant':
      return <RestaurantPeekContent data={data} />;
    case 'dish':
      return <DishPeekContent data={data} />;
    case 'visit':
      return <VisitPeekContent data={data} />;
    default:
      return null;
  }
}
