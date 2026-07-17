import React from 'react';

import type { PeekPreviewData } from '@/components/peek/types';

import PeekablePressable from './PeekablePressable';

import type { ViewStyle, StyleProp } from 'react-native';

interface GridPeekItemProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
  previewData: PeekPreviewData;
  onPress?: (() => void) | undefined;
}

const GridPeekItem = React.memo<GridPeekItemProps>(({ children, style, previewData, onPress }) => {
  return (
    <PeekablePressable
      style={style}
      previewData={previewData}
      onPress={onPress}
      scaleValue={1.05}
      sourceBorderRadius={12}
      className="bg-card dark:bg-dark-card rounded-xl mb-2 overflow-hidden"
    >
      {children}
    </PeekablePressable>
  );
});

GridPeekItem.displayName = 'GridPeekItem';

export default GridPeekItem;
