import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import type { VisitDetailsDTO } from '@/features/visits/types/visit-dto';
import { useTheme } from '@/lib/context/ThemeContext';

interface VisitDetailsProps {
  visit: VisitDetailsDTO;
}

export default function VisitDetails({ visit }: VisitDetailsProps) {
  const { isDarkMode } = useTheme();

  return (
    <View className="p-4 h-full bg-surface">
      <Text className="text-base font-bold text-ink-subtle mb-2">Restaurante visitado</Text>
      <TouchableOpacity
        className="flex-row items-center py-3 border-b border-line mb-8"
        onPress={() =>
          router.push({ pathname: '/restaurants/[id]/view', params: { id: visit.restaurant.id } })
        }
      >
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">{visit.restaurant.name}</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={isDarkMode ? '#777' : '#999'} />
      </TouchableOpacity>

      <Text className="text-base font-bold text-ink-subtle mb-2">Comentarios</Text>
      {visit.comments ? (
        <Text className="text-base text-[#4A4A4A] mb-4 py-3">{visit.comments}</Text>
      ) : (
        <Text className="text-base italic text-[#999] mb-4 py-3">Sin comentarios</Text>
      )}
    </View>
  );
}
