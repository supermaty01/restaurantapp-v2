import { Ionicons } from '@expo/vector-icons';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm/sql';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { useDishById } from '@/features/dishes/hooks/useDishById';
import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import Tag from '@/features/tags/components/Tag';
import { useTheme } from '@/lib/context/ThemeContext';
import { canDeleteDishPermanently, softDeleteDish } from '@/lib/helpers/soft-delete';
import * as schema from '@/services/db/schema';
import { exportDish } from '@/services/share/exportService';

export default function DishDetailScreen() {

  const router = useRouter();
  const { id } = useGlobalSearchParams(); // Obtiene el id desde la ruta
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const dish = useDishById(Number(id));
  const { isDarkMode } = useTheme();
  const [isSharing, setIsSharing] = useState(false);

  function handleEdit() {
    router.push({
      pathname: '/dishes/[id]/edit',
      params: { id: id?.toString() },
    })
  }

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportDish(drizzleDb, Number(id));
    } catch {
      Alert.alert('Error', 'No se pudo compartir el plato');
    } finally {
      setIsSharing(false);
    }
  }

  async function handleDelete() {
    try {
      // Verificar si el plato puede ser eliminado permanentemente
      const canDeletePermanently = await canDeleteDishPermanently(drizzleDb, Number(id));

      const message = canDeletePermanently
        ? '¿Estás seguro de que deseas eliminar este plato? Esta acción no se puede deshacer.'
        : '¿Estás seguro de que deseas eliminar este plato? El plato seguirá visible en visitas existentes.';

      Alert.alert(
        'Eliminar Plato',
        message,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                if (canDeletePermanently) {
                  // Eliminar permanentemente
                  await drizzleDb.delete(schema.dishes).where(eq(schema.dishes.id, Number(id)));
                } else {
                  // Soft delete
                  await softDeleteDish(drizzleDb, Number(id));
                }

                Alert.alert('Eliminado', 'Plato eliminado correctamente');
                router.back();
              } catch {
                Alert.alert('Error', 'No se pudo eliminar el plato');
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch {
      Alert.alert('Error', 'No se pudo verificar las referencias del plato');
    }
  }

  if (!dish) {
    return (
      <View className="flex-1 justify-center items-center bg-muted dark:bg-dark-muted p-4">
        <Text className="text-base text-gray-800 dark:text-gray-200">No se encontró el plato</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-muted dark:bg-dark-muted">
      <ImageDisplay images={dish.images} />

      {/* Nombre y botones Editar/Eliminar */}
      <View className="flex-row items-center justify-between px-4 mt-4">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {dish.name}
          </Text>
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
          <TouchableOpacity
            className="bg-primary dark:bg-dark-primary p-2 rounded-full mr-2"
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-destructive dark:bg-dark-destructive p-2 rounded-full"
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {dish.deleted && (
        <View className="mt-3 mx-4 bg-red-100 px-2 py-2 rounded flex-row gap-2 border-red-600 border-[1px]">
          <Ionicons className="flex" name="warning-outline" size={16} color="#dc2626" />
          <Text className="flex text-red-600 text-sm">Este plato ha sido eliminado</Text>
        </View>
      )}
      {dish.restaurant.deleted && (
        <View className="mt-3 mx-4 bg-orange-100 px-2 py-2 rounded flex-row gap-2 border-orange-600 border-[1px]">
          <Ionicons className="flex" name="warning-outline" size={16} color="#ea580c" />
          <Text className="flex text-orange-600 text-sm">El restaurante de este plato ha sido eliminado</Text>
        </View>
      )}

      <View className="bg-card dark:bg-dark-card my-4 mx-4 p-4 rounded-xl">
        <View className="flex-row mb-4">
          <View className="flex-1 items-center">
            <Text className="text-base font-bold text-primary dark:text-dark-primary">Detalles</Text>
            <View className="w-full h-1 bg-primary dark:bg-dark-primary mt-1 " />
          </View>
        </View>

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Restaurante visitado</Text>
        <TouchableOpacity
          className="flex-row items-center py-3 border-b border-gray-200 dark:border-gray-700 mb-8"
          onPress={() =>
            router.push({ pathname: '/restaurants/[id]/view', params: { id: dish.restaurant.id } })
          }
        >
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-800 dark:text-gray-200">{dish.restaurant.name}</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color={isDarkMode ? "#777" : "#999"} />
        </TouchableOpacity>

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Precio</Text>
        {dish.price ? (
          <Text className="text-xl font-bold text-primary dark:text-dark-primary mb-4">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              minimumFractionDigits: 0,
            }).format(dish.price)}
          </Text>

        ) : (
          <Text className="text-base italic text-gray-500 dark:text-gray-400 mb-4">
            Sin precio
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Comentarios</Text>
        {dish.comments ? (
          <Text className="text-base text-gray-800 dark:text-gray-200 mb-4">{dish.comments}</Text>
        ) : (
          <Text className="text-base italic text-gray-500 dark:text-gray-400 mb-4">
            Sin comentarios
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Etiquetas</Text>
        {dish.tags?.length > 0 ? (
          <View className="flex-row flex-wrap mb-4">
            {dish.tags.map((tag) => (
              <Tag key={tag.id} color={tag.color} name={tag.name} deleted={tag.deleted} />
            ))}
          </View>
        ) : (
          <Text className="text-base italic text-gray-500 dark:text-gray-400 mb-4">
            Sin etiquetas
          </Text>
        )}

        <Text className="text-base font-bold text-gray-400 dark:text-gray-300 my-2">Calificación</Text>
        <View className="flex-row">
          <RatingStars
            value={dish.rating}
            readOnly
          />
        </View>


      </View>
    </ScrollView >
  );
}
