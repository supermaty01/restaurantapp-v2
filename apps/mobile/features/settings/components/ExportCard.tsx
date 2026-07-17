import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import ProgressBar from './ProgressBar';


interface ExportCardProps {
  onPress: () => void;
  isExporting: boolean;
  exportProgress: number;
  disabled: boolean;
}

const ExportCard: React.FC<ExportCardProps> = ({
  onPress,
  isExporting,
  exportProgress,
  disabled
}) => {
  const { isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      className="bg-card dark:bg-dark-card p-4 rounded-xl mb-4"
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.7 : 1 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons
            name="cloud-upload-outline"
            size={24}
            color={isDarkMode ? "#B27A4D" : "#905c36"}
            className="mr-2"
          />
          <Text className="text-lg font-bold text-text dark:text-dark-text ml-2">Exportar datos</Text>
        </View>
        <Ionicons
          name="chevron-forward-outline"
          size={20}
          color={isDarkMode ? "#777" : "#999"}
        />
      </View>
      <Text className="text-gray-600 dark:text-gray-400 mt-1">
        Crea una copia de seguridad de todos tus datos e imágenes
      </Text>

      {isExporting && <ProgressBar progress={exportProgress} isDarkMode={isDarkMode} />}
    </TouchableOpacity>
  );
};

export default ExportCard;
