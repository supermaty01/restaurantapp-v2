import React from 'react';
import { View, Text } from 'react-native';

interface ProgressBarProps {
  progress: number;
  isDarkMode?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, isDarkMode }) => {
  return (
    <View className="mt-4">
      <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <View
          className={isDarkMode ? "h-full bg-dark-primary" : "h-full bg-primary"}
          style={{ width: `${progress}%` }}
        />
      </View>
      <Text className="text-center text-gray-600 dark:text-gray-400 mt-1">
        {progress}% completado
      </Text>
    </View>
  );
};

export default ProgressBar;
