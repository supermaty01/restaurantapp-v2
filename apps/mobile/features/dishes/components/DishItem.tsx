import React from 'react';
import { Text, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { PressableScale } from '@/components/ui/Motion';
import { Thumbnail } from '@/components/ui/Thumbnail';
import type { ImageDTO } from '@/features/images/types/image-dto';
import Tag from '@/features/tags/components/Tag';
import type { TagDTO } from '@/features/tags/types/tag-dto';

interface DishItemProps {
  name: string;
  comments: string | null;
  tags: TagDTO[];
  rating: number | null;
  images: ImageDTO[];
  onPress?: (() => void) | undefined;
}

/** A dish in a list. Same anatomy as RestaurantItem (docs/14). */
const DishItem = React.memo<DishItemProps>(({ name, comments, tags, rating, images, onPress }) => {
  const image = images[0];

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      className="mb-3 rounded-xl border border-line bg-surface p-2.5"
    >
      <View className="flex-row gap-3">
        <Thumbnail
          name={name}
          uri={image?.uri}
          remoteKey={image?.remoteKey}
          size={66}
          icon="fast-food"
        />

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
    </PressableScale>
  );
});

DishItem.displayName = 'DishItem';

export default DishItem;
