import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface ThemeCardProps {
  onPress: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ onPress }) => {
  const { themeMode, isDarkMode, colors } = useTheme();

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
  const getThemeIcon = (): IoniconName => {
    if (themeMode === 'system') {
      return isDarkMode ? 'moon' : 'sunny';
    }
    return themeMode === 'dark' ? 'moon' : 'sunny';
  };

  return (
    <TouchableOpacity className="bg-surface p-4 rounded-xl mb-4" onPress={onPress}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name={getThemeIcon()} size={24} color={colors.primary} className="mr-2" />
          <Text className="text-lg font-bold text-ink ml-2">Tema</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-ink-muted mr-2">{getThemeDisplayText()}</Text>
          <Ionicons name="chevron-forward-outline" size={20} color={colors.inkSubtle} />
        </View>
      </View>
      <Text className="text-ink-muted mt-1">
        Cambia entre tema claro, oscuro o usa la configuración del sistema
      </Text>
    </TouchableOpacity>
  );
};

export default ThemeCard;
