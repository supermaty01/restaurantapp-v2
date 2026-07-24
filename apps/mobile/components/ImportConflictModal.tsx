import { Ionicons } from '@expo/vector-icons';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import type { ShareFileData, ConflictResult, ConflictResolution } from '@/services/share/types';

interface ImportConflictModalProps {
  visible: boolean;
  onClose: () => void;
  shareData: ShareFileData | null;
  conflict: ConflictResult | null;
  onResolve: (resolution: ConflictResolution) => void;
}

export default function ImportConflictModal({
  visible,
  onClose,
  shareData,
  conflict,
  onResolve,
}: ImportConflictModalProps) {
  const { isDarkMode } = useTheme();

  if (!shareData || !conflict) return null;

  const getEntityTypeLabel = () => {
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

  const getEntityName = () => {
    if (shareData.type === 'restaurant') return shareData.restaurant?.name;
    if (shareData.type === 'dish') return shareData.dish?.name;
    if (shareData.type === 'visit') return shareData.visit?.visitedAt;
    return '';
  };

  const getIncomingRestaurantName = () => {
    if (shareData.type === 'restaurant') return shareData.restaurant?.name;
    return shareData.includedRestaurant?.name;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/50 px-4">
        <View
          className={`w-full max-w-sm rounded-2xl p-5 ${isDarkMode ? 'bg-dark-card' : 'bg-surface'}`}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={isDarkMode ? '#FFA500' : '#F59E0B'}
              />
              <Text
                className={`text-lg font-bold ml-2 ${isDarkMode ? 'text-on-primary' : 'text-ink'}`}
              >
                Restaurante Similar Encontrado
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#888' : '#666'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="max-h-80">
            <Text className={`text-base mb-4 ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}>
              Ya tienes un restaurante llamado &quot;{conflict.existingEntity?.name}&quot; en tu
              lista.
            </Text>

            <Text className={`text-base mb-2 ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}>
              Estás importando: <Text className="font-bold">{getEntityTypeLabel()}</Text>
            </Text>
            <Text className={`text-base mb-4 ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}>
              Nombre: <Text className="font-bold">{getEntityName()}</Text>
            </Text>

            {shareData.type !== 'restaurant' && (
              <Text
                className={`text-base mb-4 ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}
              >
                Restaurante incluido:{' '}
                <Text className="font-bold">{getIncomingRestaurantName()}</Text>
              </Text>
            )}

            <Text
              className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-on-primary' : 'text-ink'}`}
            >
              ¿Qué deseas hacer?
            </Text>
          </ScrollView>

          {/* Actions */}
          <View className="mt-4 gap-3">
            {/* Use existing */}
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${isDarkMode ? 'bg-dark-muted border-gray-600' : 'bg-sunken border-line'}`}
              onPress={() =>
                conflict.existingEntity &&
                onResolve({ type: 'use_existing', existingId: conflict.existingEntity.id })
              }
            >
              <Ionicons name="link-outline" size={24} color={isDarkMode ? '#7A9455' : '#93AE72'} />
              <View className="ml-3 flex-1">
                <Text className={`font-bold ${isDarkMode ? 'text-on-primary' : 'text-ink'}`}>
                  Usar el restaurante existente
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}>
                  Vincular el {getEntityTypeLabel().toLowerCase()} al restaurante &quot;
                  {conflict.existingEntity?.name}&quot;
                </Text>
              </View>
            </TouchableOpacity>

            {/* Create new */}
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${isDarkMode ? 'bg-dark-muted border-gray-600' : 'bg-sunken border-line'}`}
              onPress={() => onResolve({ type: 'create_new' })}
            >
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={isDarkMode ? '#7A9455' : '#93AE72'}
              />
              <View className="ml-3 flex-1">
                <Text className={`font-bold ${isDarkMode ? 'text-on-primary' : 'text-ink'}`}>
                  Crear nuevo restaurante
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}>
                  Crear una copia del restaurante con todos sus datos
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              className={`p-3 rounded-xl ${isDarkMode ? 'bg-surface' : 'bg-sunken'}`}
              onPress={onClose}
            >
              <Text
                className={`text-center font-semibold ${isDarkMode ? 'text-ink-subtle' : 'text-ink-muted'}`}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
