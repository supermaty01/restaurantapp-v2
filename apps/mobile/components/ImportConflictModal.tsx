import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { ShareFileData, ConflictResult, ConflictResolution } from '@/services/share/types';

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
      case 'restaurant': return 'Restaurante';
      case 'dish': return 'Plato';
      case 'visit': return 'Visita';
      default: return 'Elemento';
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
        <View className={`w-full max-w-sm rounded-2xl p-5 ${isDarkMode ? 'bg-dark-card' : 'bg-white'}`}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <Ionicons name="alert-circle-outline" size={24} color={isDarkMode ? '#FFA500' : '#F59E0B'} />
              <Text className={`text-lg font-bold ml-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Restaurante Similar Encontrado
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#888' : '#666'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="max-h-80">
            <Text className={`text-base mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Ya tienes un restaurante llamado "{conflict.existingEntity?.name}" en tu lista.
            </Text>

            <Text className={`text-base mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Estás importando: <Text className="font-bold">{getEntityTypeLabel()}</Text>
            </Text>
            <Text className={`text-base mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Nombre: <Text className="font-bold">{getEntityName()}</Text>
            </Text>

            {shareData.type !== 'restaurant' && (
              <Text className={`text-base mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Restaurante incluido: <Text className="font-bold">{getIncomingRestaurantName()}</Text>
              </Text>
            )}

            <Text className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              ¿Qué deseas hacer?
            </Text>
          </ScrollView>

          {/* Actions */}
          <View className="mt-4 gap-3">
            {/* Use existing */}
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${isDarkMode ? 'bg-dark-muted border-gray-600' : 'bg-gray-50 border-gray-200'}`}
              onPress={() => onResolve({ type: 'use_existing', existingId: conflict.existingEntity!.id })}
            >
              <Ionicons name="link-outline" size={24} color={isDarkMode ? '#7A9455' : '#93AE72'} />
              <View className="ml-3 flex-1">
                <Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Usar el restaurante existente
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Vincular el {getEntityTypeLabel().toLowerCase()} al restaurante "{conflict.existingEntity?.name}"
                </Text>
              </View>
            </TouchableOpacity>

            {/* Create new */}
            <TouchableOpacity
              className={`flex-row items-center p-4 rounded-xl border ${isDarkMode ? 'bg-dark-muted border-gray-600' : 'bg-gray-50 border-gray-200'}`}
              onPress={() => onResolve({ type: 'create_new' })}
            >
              <Ionicons name="add-circle-outline" size={24} color={isDarkMode ? '#7A9455' : '#93AE72'} />
              <View className="ml-3 flex-1">
                <Text className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Crear nuevo restaurante
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Crear una copia del restaurante con todos sus datos
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              className={`p-3 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
              onPress={onClose}
            >
              <Text className={`text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

