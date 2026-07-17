import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm/sql';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import VisitDetails from '@/features/visits/components/VisitDetails'
import VisitDishes from '@/features/visits/components/VisitDishes'
import { useVisitById } from '@/features/visits/hooks/useVisitById';
import { useTheme } from '@/lib/context/ThemeContext';
import { canDeleteVisitPermanently, softDeleteVisit } from '@/lib/helpers/soft-delete';
import * as schema from '@/services/db/schema';
import { exportVisit } from '@/services/share/exportService';

const Tab = createMaterialTopTabNavigator();

export default function VisitDetailScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const visit = useVisitById(Number(id));
  const { isDarkMode } = useTheme();
  const [isSharing, setIsSharing] = useState(false);

  function handleEdit() {
    router.replace({
      pathname: '/visits/[id]/edit',
      params: { id: id?.toString() },
    });
  }

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportVisit(drizzleDb, Number(id));
    } catch {
      Alert.alert('Error', 'No se pudo compartir la visita');
    } finally {
      setIsSharing(false);
    }
  }

  async function handleDelete() {
    try {
      // Verificar si la visita puede ser eliminada permanentemente
      const canDeletePermanently = await canDeleteVisitPermanently(drizzleDb, Number(id));

      const message = canDeletePermanently
        ? '¿Estás seguro de que deseas eliminar esta visita? Esta acción no se puede deshacer.'
        : '¿Estás seguro de que deseas eliminar esta visita?';

      Alert.alert(
        'Eliminar Visita',
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
                  await drizzleDb.delete(schema.visits).where(eq(schema.visits.id, Number(id)));
                } else {
                  // Soft delete
                  await softDeleteVisit(drizzleDb, Number(id));
                }

                Alert.alert('Eliminada', 'Visita eliminada correctamente');
                router.back();
              } catch {
                Alert.alert('Error', 'No se pudo eliminar la visita');
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch {
      Alert.alert('Error', 'No se pudo verificar las referencias de la visita');
    }
  }



  if (!visit) {
    return (
      <View className="flex-1 justify-center items-center bg-muted dark:bg-dark-muted p-4">
        <Text className="text-base text-gray-800 dark:text-gray-200">
          No se encontró la visita
        </Text>
      </View>
    );
  }

  const parsedDate = parse(visit.visited_at, 'yyyy-MM-dd', new Date());
  const formattedDate = format(parsedDate, "dd 'de' MMMM, yyyy", { locale: es });

  return (
    <View className="flex-1 bg-muted dark:bg-dark-muted">
      <ImageDisplay images={visit.images} />

      <View className="flex-row items-center justify-between px-4 mt-4">
        <View className="flex-1 mr-2">
          <Text className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {formattedDate}
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
          <TouchableOpacity className="bg-primary dark:bg-dark-primary p-2 rounded-full mr-2" onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity className="bg-destructive dark:bg-dark-destructive p-2 rounded-full" onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {visit.deleted && (
        <View className="mt-3 mx-4 bg-red-100 px-2 py-2 rounded flex-row gap-2 border-red-600 border-[1px]">
          <Ionicons className="flex" name="warning-outline" size={16} color="#dc2626" />
          <Text className="flex text-red-600 text-sm">Esta visita ha sido eliminada</Text>
        </View>
      )}
      {visit.restaurant.deleted && (
        <View className="mt-3 mx-4 bg-orange-100 px-2 py-2 rounded flex-row gap-2 border-orange-600 border-[1px]">
          <Ionicons className="flex" name="warning-outline" size={16} color="#ea580c" />
          <Text className="flex text-orange-600 text-sm">El restaurante de esta visita ha sido eliminado</Text>
        </View>
      )}

      <View className="bg-card dark:bg-dark-card mt-4 mx-4 rounded-xl flex-1 overflow-hidden mb-4">
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: isDarkMode ? '#7A9455' : '#93AE72',
            tabBarInactiveTintColor: isDarkMode ? '#a0a0a0' : '#6b7280',
            tabBarIndicatorStyle: { backgroundColor: isDarkMode ? '#7A9455' : '#93AE72', height: 3 },
            tabBarLabelStyle: { fontSize: 16, fontWeight: 'bold' },
            tabBarStyle: { backgroundColor: isDarkMode ? '#2A2A2A' : 'white' },
          }}
        >
          <Tab.Screen name="Details" options={{ tabBarLabel: 'Detalles' }}>
            {() => <VisitDetails visit={visit} />}
          </Tab.Screen>
          <Tab.Screen name="Dishes" options={{ tabBarLabel: 'Platos' }}>
            {() => <VisitDishes visit={visit} />}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </View >
  );
}
