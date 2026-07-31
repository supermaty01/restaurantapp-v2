import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';


import { useDishesByRestaurant } from '@/features/dishes/hooks/useDishesByRestaurant';
import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';
import { useTheme } from '@/lib/context/ThemeContext';

interface RestaurantDishesProps {
  restaurant: RestaurantDetailsDTO;
}

export default function RestaurantDishes({ restaurant }: RestaurantDishesProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const dishes = useDishesByRestaurant(restaurant.id, true);

  return (
    <View className="p-4 h-full bg-surface">
      <FlatList
        data={dishes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Toma la primera imagen del array si existe
          const imageUrl = item.images?.[0]?.uri ?? null;
          return (
            <TouchableOpacity
              className="flex-row items-center py-3 border-b border-line"
              onPress={() =>
                router.push({ pathname: '/dishes/[id]/view', params: { id: item.id } })
              }
              style={{ opacity: item.deleted ? 0.7 : 1 }}
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
                <View className="flex-row items-center">
                  <Text className="text-base font-bold text-ink flex-1">{item.name}</Text>
                  {item.deleted && (
                    <View className="mr-1 rounded-pill bg-danger/12 px-2 py-0.5">
                      <Text className="text-danger text-xs">Eliminado</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-ink-subtle">{item.comments}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.inkSubtle} />
            </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-10">
            <Text className="text-base text-ink">No se encontraron platos.</Text>
          </View>
        }
      />
      <TouchableOpacity
        className="bg-primary py-3 rounded-lg mt-2 flex-row items-center justify-center"
        onPress={() =>
          router.push({ pathname: '/dishes/new', params: { restaurantId: restaurant.id } })
        }
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
        <Text className="text-on-primary font-bold ml-2">Añadir Plato</Text>
      </TouchableOpacity>
    </View>
  );
}
