import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

interface ThemeCardProps {
  onPress: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ onPress }) => {
  const { themeMode, isDarkMode } = useTheme();

  // Get the display text based on current theme mode
  const getThemeDisplayText = () => {
    switch (themeMode) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Oscuro';
      case 'system':
        return 'Sistema';
      default:
        return 'Sistema';
    }
  };

  // Get the icon based on current theme mode
  const getThemeIcon = () => {
    if (themeMode === 'system') {
      return isDarkMode ? 'moon' : 'sunny';
    }
    return themeMode === 'dark' ? 'moon' : 'sunny';
  };

  return (
    <TouchableOpacity
      className="bg-card dark:bg-dark-card p-4 rounded-xl mb-4"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons 
            name={getThemeIcon() as any} 
            size={24} 
            color={isDarkMode ? "#B27A4D" : "#905c36"} 
            className="mr-2" 
          />
          <Text className="text-lg font-bold text-text dark:text-dark-text ml-2">Tema</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-gray-600 dark:text-gray-400 mr-2">{getThemeDisplayText()}</Text>
          <Ionicons name="chevron-forward-outline" size={20} color={isDarkMode ? "#777" : "#999"} />
        </View>
      </View>
      <Text className="text-gray-600 dark:text-gray-400 mt-1">
        Cambia entre tema claro, oscuro o usa la configuración del sistema
      </Text>
    </TouchableOpacity>
  );
};

export default ThemeCard;
