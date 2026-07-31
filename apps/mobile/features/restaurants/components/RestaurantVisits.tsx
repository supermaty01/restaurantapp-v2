import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';
import { useVisitsByRestaurant } from '@/features/visits/hooks/useVisitsByRestaurant';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatVisitDate } from '@/lib/helpers/date';

interface RestaurantVisitsProps {
  restaurant: RestaurantDetailsDTO;
}

export default function RestaurantVisits({ restaurant }: RestaurantVisitsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const visits = useVisitsByRestaurant(restaurant.id);

  return (
    <View className="p-4 h-full bg-surface">
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Toma la primera imagen del array si existe
          const imageUrl = item.images?.[0]?.uri ?? null;
          return (
            <TouchableOpacity
              className="flex-row items-center py-3 border-b border-line"
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
                <View className="w-14 h-14 rounded bg-line-strong mr-3" />
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-ink">
                  {formatVisitDate(item.visited_at)}
                </Text>
                {item.comments && <Text className="text-sm text-ink-subtle">{item.comments}</Text>}
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.inkSubtle} />
            </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-10">
            <Text className="text-base text-ink">No se encontraron visitas.</Text>
          </View>
        }
      />
      <TouchableOpacity
        className="bg-primary py-3 rounded-lg mt-2 flex-row items-center justify-center"
        onPress={() =>
          router.push({ pathname: '/visits/new', params: { restaurantId: restaurant.id } })
        }
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
        <Text className="text-on-primary font-bold ml-2">Añadir Visita</Text>
      </TouchableOpacity>
    </View>
  );
}
