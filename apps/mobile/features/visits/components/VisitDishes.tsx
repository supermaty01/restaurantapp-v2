import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

import { Photo } from '@/components/ui/Photo';
import { useDishesDetails } from '@/features/dishes/hooks/useDishesDetails';
import type { VisitDetailsDTO } from '@/features/visits/types/visit-dto';
import { useTheme } from '@/lib/context/ThemeContext';

interface VisitDishesProps {
  visit: VisitDetailsDTO;
}

export default function VisitDishes({ visit }: VisitDishesProps) {
  const router = useRouter();
  const { colors } = useTheme();

  // Obtener los IDs de los platos de la visita
  const dishIds = visit.dishes.map((dish) => dish.id);

  // Obtener los detalles completos de los platos (incluyendo imágenes)
  const dishesWithDetails = useDishesDetails(dishIds);

  return (
    <View className="p-4 h-full bg-surface">
      <FlatList
        data={dishesWithDetails}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Toma la primera imagen del array si existe
          const image = item.images?.[0];
          return (
            <TouchableOpacity
              className="flex-row items-center py-3 border-b border-line"
              onPress={() =>
                router.push({ pathname: '/dishes/[id]/view', params: { id: item.id } })
              }
              style={{ opacity: item.deleted ? 0.7 : 1 }}
            >
              {image ? (
                <Photo
                  uri={image.uri}
                  remoteKey={image.remoteKey}
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
                {item.comments && <Text className="text-sm text-ink-subtle">{item.comments}</Text>}
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
    </View>
  );
}
