import React from 'react';
import { View, Text } from 'react-native';

interface ProgressBarProps {
  progress: number;
  isDarkMode?: boolean | undefined;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, isDarkMode }) => {
  return (
    <View className="mt-4">
      <View className="h-2 bg-sunken rounded-full overflow-hidden">
        <View
          className={isDarkMode ? 'h-full bg-dark-primary' : 'h-full bg-primary'}
          style={{ width: `${progress}%` }}
        />
      </View>
      <Text className="text-center text-ink-muted mt-1">{progress}% completado</Text>
    </View>
  );
};

export default ProgressBar;
