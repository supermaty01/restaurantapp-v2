import React from 'react';
import { View, Text } from 'react-native';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <View className="mt-4">
      <View className="h-2 overflow-hidden rounded-pill bg-sunken">
        <View className="h-full rounded-pill bg-primary" style={{ width: `${progress}%` }} />
      </View>
      <Text className="mt-1.5 text-center text-[13px] text-ink-muted">{progress}% completado</Text>
    </View>
  );
};

export default ProgressBar;
