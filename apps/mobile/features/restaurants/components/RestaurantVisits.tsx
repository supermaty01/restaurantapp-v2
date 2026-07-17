import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image } from 'expo-image';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

import { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';
import { useVisitsByRestaurant } from '@/features/visits/hooks/useVisitsByRestaurant';
import { formatVisitDate } from '@/lib/helpers/date';

interface RestaurantVisitsProps {
  restaurant: RestaurantDetailsDTO;
}

export default function RestaurantVisits({ restaurant }: RestaurantVisitsProps) {
  const router = useRouter();
  const visits = useVisitsByRestaurant(restaurant.id);

  return (
    <View className="p-4 h-full bg-card dark:bg-dark-card">
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Toma la primera imagen del array si existe
          const imageUrl = item.images && item.images.length > 0 ? item.images[0].uri : null;
          return (
            <TouchableOpacity
              className="flex-row items-center py-3 border-b border-gray-200 dark:border-gray-700"
              onPress={() =>
                router.push({ pathname: '/visits/[id]/view', params: { id: item.id } })
              }
            >
              {imageUrl ? (
                <Image
                  source={imageUrl}
                  style={{ width: 56, height: 56, borderRadius: 4, marginRight: 12 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View className="w-14 h-14 rounded bg-gray-300 dark:bg-gray-700 mr-3" />
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-800 dark:text-gray-200">
                  {formatVisitDate(item.visited_at)}
                </Text>
                {item.comments && (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">{item.comments}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color="#999" className="dark:text-gray-400" />
            </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-10">
            <Text className="text-base text-gray-800 dark:text-gray-200">No se encontraron visitas.</Text>
          </View>
        }
      />
      <TouchableOpacity
        className="bg-primary dark:bg-dark-primary py-3 rounded-lg mt-2 flex-row items-center justify-center"
        onPress={() =>
          router.push({ pathname: '/visits/new', params: { restaurantId: restaurant.id } })
        }
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text className="text-white font-bold ml-2">Añadir Visita</Text>
      </TouchableOpacity>
    </View>
  );
}
