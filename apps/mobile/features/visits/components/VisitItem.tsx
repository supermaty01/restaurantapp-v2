import React from 'react';
import { Text, View } from 'react-native';

import type { PeekPreviewData } from '@/components/peek/types';
import PeekablePressable from '@/components/PeekablePressable';
import { Chip } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';

interface VisitItemProps {
  imageUrl: string | null;
  date: string;
  title: string;
  comments: string | null;
  previewData: PeekPreviewData;
  onPress?: (() => void) | undefined;
  deleted?: boolean | undefined;
  restaurantDeleted?: boolean | undefined;
}

/**
 * A visit in a list (docs/14).
 *
 * The restaurant leads and the date is metadata beneath it — the old row put
 * "12 ago - Trattoria" in one bold line, which made the date compete with the
 * only part you actually scan for.
 */
const VisitItem = React.memo<VisitItemProps>(
  ({ imageUrl, date, title, comments, previewData, onPress, deleted, restaurantDeleted }) => {
    return (
      <PeekablePressable
        previewData={previewData}
        onPress={onPress}
        scaleValue={1.02}
        baseOpacity={deleted || restaurantDeleted ? 0.6 : 1}
        className="mb-3 flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5"
      >
        <Thumbnail name={title} uri={imageUrl} size={66} icon="restaurant" />

        <View className="min-w-0 flex-1 justify-center">
          <Text className="font-bold text-[15px] text-ink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="mt-0.5 text-[12px] text-ink-subtle" numberOfLines={1}>
            {date}
            {comments ? ` · ${comments}` : ''}
          </Text>

          {deleted || restaurantDeleted ? (
            <View className="mt-1.5 flex-row gap-1.5">
              {deleted ? <Chip label="Eliminada" tone="primary" /> : null}
              {restaurantDeleted ? <Chip label="Sin restaurante" tone="accent" /> : null}
            </View>
          ) : null}
        </View>
      </PeekablePressable>
    );
  },
);

VisitItem.displayName = 'VisitItem';

export default VisitItem;
