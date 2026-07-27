import React from 'react';
import { Text, View } from 'react-native';

import type { PeekPreviewData } from '@/components/peek/types';
import PeekablePressable from '@/components/PeekablePressable';
import RatingStars from '@/components/RatingStars';
import { Thumbnail } from '@/components/ui/Thumbnail';
import Tag from '@/features/tags/components/Tag';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { imagePathToUri } from '@/lib/helpers/image-paths';

interface RestaurantItemProps {
  name: string;
  comments: string | null;
  tags: TagDTO[];
  rating: number | null;
  imageUrl?: string | undefined;
  /** Clave en R2 de esa foto: la reserva si el fichero local no está. */
  imageRemoteKey?: string | null | undefined;
  previewData: PeekPreviewData;
  onPress?: (() => void) | undefined;
}

/**
 * A restaurant in a list (docs/14).
 *
 * The thumbnail always draws something: most entries in a real diary have no
 * photo, and a column of empty grey boxes reads as broken rather than as "no
 * picture yet". "Sin comentarios" is gone for the same reason — an absent note
 * is better said with space than with a line of italic apology.
 */
const RestaurantItem = React.memo<RestaurantItemProps>(
  ({ name, comments, tags, rating, imageUrl, imageRemoteKey, previewData, onPress }) => {
    const uri = imageUrl ? imagePathToUri(imageUrl) : undefined;

    return (
      <PeekablePressable
        previewData={previewData}
        onPress={onPress}
        scaleValue={1.02}
        className="mb-3 rounded-xl border border-line bg-surface p-2.5"
      >
        <View className="flex-row gap-3">
          <Thumbnail name={name} uri={uri} remoteKey={imageRemoteKey} size={66} icon="restaurant" />

          <View className="min-w-0 flex-1 justify-center">
            <Text className="font-bold text-[15px] text-ink" numberOfLines={1}>
              {name}
            </Text>

            {comments ? (
              <Text className="mt-0.5 text-[12px] text-ink-subtle" numberOfLines={2}>
                {comments}
              </Text>
            ) : null}

            {/* Always rendered, so a row with a rating and one without are the
                same height — a list that jitters as you scroll is worse than a
                row of dim stars. */}
            <View className="mt-1.5">
              <RatingStars value={rating ?? 0} size={14} gap={1} readOnly />
            </View>
          </View>
        </View>

        {tags.length > 0 ? (
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag.id} color={tag.color} name={tag.name} />
            ))}
          </View>
        ) : null}
      </PeekablePressable>
    );
  },
);

RestaurantItem.displayName = 'RestaurantItem';

export default RestaurantItem;
