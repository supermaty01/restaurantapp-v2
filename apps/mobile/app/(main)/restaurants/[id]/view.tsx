import { Ionicons } from '@expo/vector-icons';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import RestaurantDetails from '@/features/restaurants/components/RestaurantDetails';
import RestaurantDishes from '@/features/restaurants/components/RestaurantDishes';
import RestaurantVisits from '@/features/restaurants/components/RestaurantVisits';
import { useRestaurantById } from '@/features/restaurants/hooks/useRestaurantById';
import {
  canHardDeleteRestaurant,
  hardDeleteRestaurant,
  softDeleteRestaurant,
} from '@/features/restaurants/repositories/restaurantRepository';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { exportRestaurant } from '@/services/share/exportService';

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const drizzleDb = useDatabase();
  const restaurant = useRestaurantById(Number(id));
  const [isSharing, setIsSharing] = useState(false);

  function handleEdit() {
    router.push({
      pathname: '/restaurants/[id]/edit',
      params: { id: id?.toString() },
    });
  }

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportRestaurant(drizzleDb, Number(id));
    } catch {
      Alert.alert('Error', 'No se pudo compartir el restaurante');
    } finally {
      setIsSharing(false);
    }
  }

  async function handleDelete() {
    try {
      // Verificar si el restaurante puede ser eliminado permanentemente
      const canDeletePermanently = await canHardDeleteRestaurant(drizzleDb, Number(id));

      const message = canDeletePermanently
        ? '¿Estás seguro de que deseas eliminar este restaurante? Esta acción no se puede deshacer.'
        : '¿Estás seguro de que deseas eliminar este restaurante? El restaurante seguirá visible en platos y visitas existentes.';

      Alert.alert(
        'Eliminar Restaurante',
        message,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  if (canDeletePermanently) {
                    await hardDeleteRestaurant(drizzleDb, Number(id));
                  } else {
                    await softDeleteRestaurant(drizzleDb, Number(id));
                  }

                  Alert.alert('Eliminado', 'Restaurante eliminado correctamente');
                  router.back();
                } catch {
                  Alert.alert('Error', 'No se pudo eliminar el restaurante');
                }
              })();
            },
          },
        ],
        { cancelable: true },
      );
    } catch {
      Alert.alert('Error', 'No se pudo verificar las referencias del restaurante');
    }
  }

  if (!restaurant) {
    return (
      <View className="flex-1 justify-center items-center bg-canvas p-4">
        <Text className="text-base text-ink">No se encontró el restaurante</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <ImageDisplay images={restaurant.images} />

      <View className="flex-row items-center justify-between px-4 mt-4">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-ink">{restaurant.name}</Text>
        </View>
        <View className="flex-row">
          <TouchableOpacity
            className="bg-blue-500 p-2 rounded-full mr-2"
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size={20} color="#fff" />
            ) : (
              <Ionicons name="share-outline" size={20} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity className="bg-primary p-2 rounded-full mr-2" onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity className="bg-danger p-2 rounded-full" onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {restaurant.deleted && (
        <View className="mt-3 mx-4 bg-red-100 px-2 py-2 rounded flex-row gap-2 border-red-600 border-[1px]">
          <Ionicons className="flex" name="warning-outline" size={16} color="#dc2626" />
          <Text className="flex text-danger text-sm">Este restaurante ha sido eliminado</Text>
        </View>
      )}

      <View className="bg-surface mt-4 mx-4 rounded-xl flex-1 overflow-hidden mb-4">
        <SegmentedTabs
          tabs={[
            {
              key: 'details',
              label: 'Detalles',
              render: () => <RestaurantDetails restaurant={restaurant} />,
            },
            {
              key: 'visits',
              label: 'Visitas',
              render: () => <RestaurantVisits restaurant={restaurant} />,
            },
            {
              key: 'dishes',
              label: 'Platos',
              render: () => <RestaurantDishes restaurant={restaurant} />,
            },
          ]}
        />
      </View>
    </View>
  );
}
