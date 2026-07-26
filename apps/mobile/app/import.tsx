import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import ImportConflictModal from '@/components/ImportConflictModal';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import {
  parseShareFile,
  checkRestaurantConflict,
  importRestaurantFile,
  importDishFile,
  importVisitFile,
} from '@/services/share/importService';
import type { ShareFileData, ConflictResult, ConflictResolution } from '@/services/share/types';

import type { ComponentProps } from 'react';

export default function ImportScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const drizzleDb = useDatabase();
  const { colors } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareFileData | null>(null);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateToEntity = useCallback(
    (type: string, id: number) => {
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
    },
    [router],
  );

  const performImport = useCallback(
    async (data: ShareFileData, resolution?: ConflictResolution) => {
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
          // Se va directo a lo importado en vez de pedir un "Aceptar": el
          // único motivo para pararse era anunciar que había ido bien, y eso lo
          // dice mejor la propia entrada apareciendo en pantalla.
          toast.notify(`Importado: ${result.entityName}`);
          navigateToEntity(result.entityType, result.entityId!);
        } else {
          setError(result?.error || 'Error desconocido al importar');
        }
      } catch {
        setError('Error al importar el archivo');
      } finally {
        setLoading(false);
      }
    },
    [drizzleDb, navigateToEntity, toast],
  );

  const handleImport = useCallback(
    async (fileUri: string) => {
      try {
        setLoading(true);
        setError(null);

        const data = await parseShareFile(fileUri);
        if (!data) {
          setError(
            'No se pudo leer el archivo. Puede estar corrupto o ser de una versión incompatible.',
          );
          setLoading(false);
          return;
        }

        setShareData(data);

        const restaurantName =
          data.type === 'restaurant' ? data.restaurant?.name : data.includedRestaurant?.name;

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
    },
    [drizzleDb, performImport],
  );

  useEffect(() => {
    if (uri) {
      void handleImport(decodeURIComponent(uri));
    } else {
      setError('No se recibió ningún archivo');
      setLoading(false);
    }
  }, [handleImport, uri]);

  const handleConflictResolve = (resolution: ConflictResolution) => {
    setShowConflictModal(false);
    if (shareData) {
      void performImport(shareData, resolution);
    }
  };

  const getEntityTypeIcon = (): ComponentProps<typeof Ionicons>['name'] => {
    if (!shareData) return 'document-outline';
    switch (shareData.type) {
      case 'restaurant':
        return 'restaurant-outline';
      case 'dish':
        return 'fast-food-outline';
      case 'visit':
        return 'calendar-outline';
      default:
        return 'document-outline';
    }
  };

  const getEntityTypeLabel = () => {
    if (!shareData) return 'archivo';
    switch (shareData.type) {
      case 'restaurant':
        return 'Restaurante';
      case 'dish':
        return 'Plato';
      case 'visit':
        return 'Visita';
      default:
        return 'Elemento';
    }
  };

  return (
    <View className={`flex-1 justify-center items-center p-6 bg-canvas`}>
      {loading ? (
        <View className="items-center">
          <ActivityIndicator size="large" color={colors.sage} />
          <Text className={`mt-4 text-lg text-ink-muted`}>
            Importando {getEntityTypeLabel().toLowerCase()}...
          </Text>
        </View>
      ) : error ? (
        <View className="items-center">
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text className={`mt-4 text-lg text-center text-ink-muted`}>{error}</Text>
          <TouchableOpacity
            className="mt-6 bg-primary px-6 py-3 rounded-xl"
            onPress={() => router.replace('/')}
          >
            <Text className="text-on-primary font-semibold">Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="items-center">
          <Ionicons name={getEntityTypeIcon()} size={64} color={colors.sage} />
          <Text className={`mt-4 text-lg text-ink-muted`}>Procesando...</Text>
        </View>
      )}

      <ImportConflictModal
        visible={showConflictModal}
        onClose={() => {
          setShowConflictModal(false);
          router.replace('/');
        }}
        shareData={shareData}
        conflict={conflict}
        onResolve={handleConflictResolve}
      />
    </View>
  );
}
