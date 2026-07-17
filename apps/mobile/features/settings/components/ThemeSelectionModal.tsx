import { Ionicons } from '@expo/vector-icons';
import { colorScheme } from "nativewind";
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';


interface ThemeSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

const ThemeSelectionModal: React.FC<ThemeSelectionModalProps> = ({ visible, onClose }) => {
  const { themeMode, setThemeMode, isDarkMode } = useTheme();

  const handleThemeChange = async (mode: 'light' | 'dark' | 'system') => {
    await setThemeMode(mode);
    colorScheme.set(mode);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card dark:bg-dark-card rounded-t-xl p-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-text dark:text-dark-text">Seleccionar tema</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? "#E0E0E0" : "#333333"} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className={`flex-row items-center p-4 rounded-lg mb-2 ${themeMode === 'light' ? 'bg-primary/20 dark:bg-dark-primary/20' : 'bg-transparent'
              }`}
            onPress={() => handleThemeChange('light')}
          >
            <Ionicons name="sunny" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} />
            <Text className="text-lg text-text dark:text-dark-text ml-3">Claro</Text>
            {themeMode === 'light' && (
              <Ionicons name="checkmark" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} style={styles.checkIcon} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center p-4 rounded-lg mb-2 ${themeMode === 'dark' ? 'bg-primary/20 dark:bg-dark-primary/20' : 'bg-transparent'
              }`}
            onPress={() => handleThemeChange('dark')}
          >
            <Ionicons name="moon" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} />
            <Text className="text-lg text-text dark:text-dark-text ml-3">Oscuro</Text>
            {themeMode === 'dark' && (
              <Ionicons name="checkmark" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} style={styles.checkIcon} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center p-4 rounded-lg mb-4 ${themeMode === 'system' ? 'bg-primary/20 dark:bg-dark-primary/20' : 'bg-transparent'
              }`}
            onPress={() => handleThemeChange('system')}
          >
            <Ionicons name="phone-portrait" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} />
            <Text className="text-lg text-text dark:text-dark-text ml-3">Sistema</Text>
            {themeMode === 'system' && (
              <Ionicons name="checkmark" size={24} color={isDarkMode ? "#B27A4D" : "#905c36"} style={styles.checkIcon} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  checkIcon: {
    marginLeft: 'auto',
  },
});

export default ThemeSelectionModal;
