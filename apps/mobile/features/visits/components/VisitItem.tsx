import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

import { PeekPreviewData } from '@/components/peek/types';
import PeekablePressable from '@/components/PeekablePressable';

interface VisitItemProps {
  imageUrl: string | null;
  date: string;
  title: string;
  comments: string | null;
  previewData: PeekPreviewData;
  onPress?: () => void;
  deleted?: boolean;
  restaurantDeleted?: boolean;
}

const VisitItem = React.memo<VisitItemProps>(({
  imageUrl,
  date,
  title,
  comments,
  previewData,
  onPress,
  deleted,
  restaurantDeleted,
}) => {
  return (
    <PeekablePressable
      previewData={previewData}
      onPress={onPress}
      scaleValue={1.03}
      baseOpacity={deleted || restaurantDeleted ? 0.7 : 1}
      className="bg-card dark:bg-dark-card p-4 rounded-xl mb-3 shadow-sm flex-row items-center justify-between"
    >
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={{ width: 56, height: 56, borderRadius: 4 }}
          contentFit="cover"
          recyclingKey={`visit-${imageUrl}`}
          cachePolicy="memory-disk"
        />
      ) : (
        <View className="w-14 h-14 rounded bg-gray-300 dark:bg-gray-700" />
      )}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1">
            {date} - <Text className="text-gray-900 dark:text-gray-100">{title}</Text>
          </Text>
          {deleted ? (
            <View className="bg-red-100 px-2 py-0.5 rounded ml-1">
              <Text className="text-red-600 text-xs">Eliminada</Text>
            </View>
          ) : null}
          {restaurantDeleted ? (
            <View className="bg-orange-100 px-2 py-0.5 rounded ml-1">
              <Text className="text-orange-600 text-xs">Rest. eliminado</Text>
            </View>
          ) : null}
        </View>
        {comments ? (
          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4" numberOfLines={2}>
            {comments}
          </Text>
        ) : (
          <Text className="text-sm italic text-gray-600 dark:text-gray-400 mb-4">
            Sin comentarios
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward-outline" size={20} color="#6b6b6b" className="dark:text-gray-400" />
    </PeekablePressable>
  );
});

VisitItem.displayName = 'VisitItem';

export default VisitItem;
