import React from 'react';
import { View, Text } from 'react-native';

export interface TagProps {
  name: string;
  color: string;
  deleted?: boolean;
}

function getContrastYIQ(hexColor: string): string {
  const color = hexColor.replace(/^#/, '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

const Tag = React.memo<TagProps>(({ name, color, deleted }) => {
  const textColor = getContrastYIQ(color);
  return (
    <View
      style={{ backgroundColor: color, opacity: deleted ? 0.6 : 1 }}
      className="px-2 py-1 rounded-full mr-2 mb-2 flex-row items-center"
    >
      {deleted && (
        <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
      )}
      <Text style={{ color: textColor }} className="text-xs font-bold">
        {name}
      </Text>
    </View>
  );
});

Tag.displayName = 'Tag';

export default Tag;
