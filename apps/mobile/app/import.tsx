import { Ionicons } from '@expo/vector-icons';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';

import ImportConflictModal from '@/components/ImportConflictModal';
import { useTheme } from '@/lib/context/ThemeContext';
import * as schema from '@/services/db/schema';
import {
  parseShareFile,
  checkRestaurantConflict,
  importRestaurantFile,
  importDishFile,
  importVisitFile,
} from '@/services/share/importService';
import { ShareFileData, ConflictResult, ConflictResolution } from '@/services/share/types';

export default function ImportScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const { isDarkMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareFileData | null>(null);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateToEntity = useCallback((type: string, id: number) => {
    switch (type) {
      case 'restaurant':
        router.replace({ pathname: '/restaurants/[id]/view', params: { id: id.toString() } });
        break;
      case 'dish':
        router.replace({ pathname: '/dishes/[id]/view', params: { id: id.toString() } });
        break;
      case 'visit':
        router.replace({ pathname: '/visits/[id]/view', params: { id: id.toString() } });
        break;
      default:
        router.replace('/');
    }
  }, [router]);

  const performImport = useCallback(async (data: ShareFileData, resolution?: ConflictResolution) => {
    setLoading(true);
    try {
      let result;
      switch (data.type) {
        case 'restaurant':
          result = await importRestaurantFile(drizzleDb, data, resolution);
          break;
        case 'dish':
          result = await importDishFile(drizzleDb, data, resolution);
          break;
        case 'visit':
          result = await importVisitFile(drizzleDb, data, resolution);
          break;
      }

      if (result?.success) {
        Alert.alert(
          '¡Importación Exitosa!',
          `Se ha importado correctamente: ${result.entityName}`,
          [{ text: 'Aceptar', onPress: () => navigateToEntity(result.entityType, result.entityId!) }]
        );
      } else {
        setError(result?.error || 'Error desconocido al importar');
      }
    } catch {
      setError('Error al importar el archivo');
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, navigateToEntity]);

  const handleImport = useCallback(async (fileUri: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await parseShareFile(fileUri);
      if (!data) {
        setError('No se pudo leer el archivo. Puede estar corrupto o ser de una versión incompatible.');
        setLoading(false);
        return;
      }

      setShareData(data);

      const restaurantName = data.type === 'restaurant'
        ? data.restaurant?.name
        : data.includedRestaurant?.name;

      if (restaurantName) {
        const conflictResult = await checkRestaurantConflict(drizzleDb, restaurantName);
        if (conflictResult.hasConflict) {
          setConflict(conflictResult);
          setShowConflictModal(true);
          setLoading(false);
          return;
        }
      }

      await performImport(data);
    } catch {
      setError('Error al importar el archivo');
      setLoading(false);
    }
  }, [drizzleDb, performImport]);

  useEffect(() => {
    if (uri) {
      handleImport(decodeURIComponent(uri));
    } else {
      setError('No se recibió ningún archivo');
      setLoading(false);
    }
  }, [handleImport, uri]);

  const handleConflictResolve = (resolution: ConflictResolution) => {
    setShowConflictModal(false);
    if (shareData) {
      performImport(shareData, resolution);
    }
  };

  const getEntityTypeIcon = () => {
    if (!shareData) return 'document-outline';
    switch (shareData.type) {
      case 'restaurant': return 'restaurant-outline';
      case 'dish': return 'fast-food-outline';
      case 'visit': return 'calendar-outline';
      default: return 'document-outline';
    }
  };

  const getEntityTypeLabel = () => {
    if (!shareData) return 'archivo';
    switch (shareData.type) {
      case 'restaurant': return 'Restaurante';
      case 'dish': return 'Plato';
      case 'visit': return 'Visita';
      default: return 'Elemento';
    }
  };

  return (
    <View className={`flex-1 justify-center items-center p-6 ${isDarkMode ? 'bg-dark-muted' : 'bg-muted'}`}>
      {loading ? (
        <View className="items-center">
          <ActivityIndicator size="large" color={isDarkMode ? '#7A9455' : '#93AE72'} />
          <Text className={`mt-4 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Importando {getEntityTypeLabel().toLowerCase()}...
          </Text>
        </View>
      ) : error ? (
        <View className="items-center">
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text className={`mt-4 text-lg text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {error}
          </Text>
          <TouchableOpacity
            className="mt-6 bg-primary dark:bg-dark-primary px-6 py-3 rounded-xl"
            onPress={() => router.replace('/')}
          >
            <Text className="text-white font-semibold">Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="items-center">
          <Ionicons name={getEntityTypeIcon() as any} size={64} color={isDarkMode ? '#7A9455' : '#93AE72'} />
          <Text className={`mt-4 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Procesando...
          </Text>
        </View>
      )}

      <ImportConflictModal
        visible={showConflictModal}
        onClose={() => { setShowConflictModal(false); router.replace('/'); }}
        shareData={shareData}
        conflict={conflict}
        onResolve={handleConflictResolve}
      />
    </View>
  );
}

