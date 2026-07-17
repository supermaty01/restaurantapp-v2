import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { VisitDetailsDTO } from '@/features/visits/types/visit-dto'
import { useTheme } from '@/lib/context/ThemeContext';

interface VisitDetailsProps {
  visit: VisitDetailsDTO;
}

export default function VisitDetails({ visit }: VisitDetailsProps) {
  const { isDarkMode } = useTheme();

  return (
    <View className="p-4 h-full bg-white dark:bg-dark-card">
      <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Restaurante visitado</Text>
      <TouchableOpacity
        className="flex-row items-center py-3 border-b border-gray-200 dark:border-gray-700 mb-8"
        onPress={() =>
          router.push({ pathname: '/restaurants/[id]/view', params: { id: visit.restaurant.id } })
        }
      >
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800 dark:text-gray-200">{visit.restaurant.name}</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={isDarkMode ? "#777" : "#999"} />
      </TouchableOpacity>


      <Text className="text-base font-bold text-gray-400 dark:text-gray-300 mb-2">Comentarios</Text>
      {visit.comments ? (
        <Text className="text-base text-[#4A4A4A] dark:text-gray-200 mb-4 py-3">
          {visit.comments}
        </Text>
      ) : (
        <Text className="text-base italic text-[#999] dark:text-gray-400 mb-4 py-3">
          Sin comentarios
        </Text>
      )}
    </View>
  );
}
