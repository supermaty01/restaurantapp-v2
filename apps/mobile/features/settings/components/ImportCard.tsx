import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import ProgressBar from './ProgressBar';

interface ImportCardProps {
  onPress: () => void;
  isImporting: boolean;
  importProgress: number;
  disabled: boolean;
}

const ImportCard: React.FC<ImportCardProps> = ({
  onPress,
  isImporting,
  importProgress,
  disabled,
}) => {
  const { isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      className="bg-surface p-4 rounded-xl mb-4"
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.7 : 1 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons
            name="cloud-download-outline"
            size={24}
            color={isDarkMode ? '#B27A4D' : '#905c36'}
            className="mr-2"
          />
          <Text className="text-lg font-bold text-ink ml-2">Importar datos</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={isDarkMode ? '#777' : '#999'} />
      </View>
      <Text className="text-ink-muted mt-1">Restaura tus datos desde una copia de seguridad</Text>

      {isImporting && <ProgressBar progress={importProgress} isDarkMode={isDarkMode} />}
    </TouchableOpacity>
  );
};

export default ImportCard;
