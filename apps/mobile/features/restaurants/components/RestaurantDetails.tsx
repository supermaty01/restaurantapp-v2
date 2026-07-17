import React from 'react';
import { View, Text, ScrollView } from 'react-native';

import MapLocationPicker from '@/components/MapLocationPicker';
import RatingStars from '@/components/RatingStars';
import { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';
import Tag from '@/features/tags/components/Tag';

interface RestaurantDetailsProps {
  restaurant: RestaurantDetailsDTO;
}

export default function RestaurantDetails({ restaurant }: RestaurantDetailsProps) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} nestedScrollEnabled>
      <View className="p-4 bg-card dark:bg-dark-card flex-1">
        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Comentarios</Text>
        {restaurant.comments ? (
          <Text className="text-base text-[#4A4A4A] dark:text-gray-300 mb-4">
            {restaurant.comments}
          </Text>
        ) : (
          <Text className="text-base italic text-[#999] dark:text-gray-500 mb-4">
            Sin comentarios
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Etiquetas</Text>
        {restaurant.tags && restaurant.tags.length > 0 ? (
          <View className="flex-row flex-wrap mb-4">
            {restaurant.tags.map((tag) => (
              <Tag key={tag.id} color={tag.color} name={tag.name} deleted={tag.deleted} />
            ))}
          </View>
        ) : (
          <Text className="text-sm italic text-[#999] dark:text-gray-500 mb-4">
            Sin etiquetas
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Ubicación</Text>
        {(restaurant.latitude && restaurant.longitude) ? (
          <MapLocationPicker location={{
            latitude: restaurant.latitude,
            longitude: restaurant.longitude
          }} editable={false} />
        ) : (
          <Text className="text-sm italic text-[#999] dark:text-gray-500">
            Sin ubicación
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 my-2">Calificación</Text>
        <View>
          <RatingStars value={restaurant.rating} readOnly />
        </View>
      </View>
    </ScrollView>
  );
}