import React from 'react';
import { View, Text } from 'react-native';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  // Redondeado: quien mira una barra de progreso quiere saber si queda mucho, no
  // que va por el 47,33333333%. Los decimales solo hacen que el número baile de
  // ancho y llame la atención sobre sí mismo.
  const percent = Math.round(progress);

  return (
    <View className="mt-4">
      <View className="h-2 overflow-hidden rounded-pill bg-sunken">
        <View className="h-full rounded-pill bg-primary" style={{ width: `${percent}%` }} />
      </View>
      <Text className="mt-1.5 text-center text-[13px] text-ink-muted">{percent}% completado</Text>
    </View>
  );
};

export default ProgressBar;
