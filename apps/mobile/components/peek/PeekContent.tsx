import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { Chip } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import Tag from '@/features/tags/components/Tag';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';

import type { PeekPreviewData } from './types';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** The three shapes reduced to what a preview actually shows. */
interface Preview {
  title: string;
  /** One line under the title: the place, the date, whatever situates it. */
  context: string | null;
  contextIcon: IconName;
  kindLabel: string;
  rating: number | null;
  tags: TagDTO[];
  comments: string | null;
  imageUrl: string | undefined;
}

function toPreview(data: PeekPreviewData): Preview {
  if (data.type === 'visit') {
    return {
      title: data.restaurantName,
      context: data.date,
      contextIcon: 'calendar-outline',
      kindLabel: 'Visita',
      rating: null,
      tags: [],
      comments: data.comments,
      imageUrl: data.imageUrl,
    };
  }

  return {
    title: data.name,
    context: null,
    contextIcon: 'restaurant-outline',
    kindLabel: data.type === 'dish' ? 'Plato' : 'Lugar',
    rating: data.rating,
    tags: data.tags,
    comments: data.comments,
    imageUrl: data.imageUrl,
  };
}

/**
 * What a long press shows.
 *
 * The old version was the same block written three times, stacking an image
 * over a plain column of text. Two things were wrong with it beyond the
 * duplication: the photo was rendered with `contentFit="contain"` on a grey
 * box, so every picture that was not exactly 4:3 came framed in grey bars; and
 * a preview that looks like a smaller version of the row it came from tells you
 * nothing you could not already see.
 *
 * Now it is a card: the photo fills the top edge to edge, the title sits over
 * it on a scrim, and the details below are the part the list row had to leave
 * out. Entries with no photo get the warm placeholder rather than a bare
 * heading.
 */
export default function PeekContent({ data }: { data: PeekPreviewData }) {
  const { colors } = useTheme();
  const preview = toPreview(data);

  return (
    <View>
      <View className="overflow-hidden rounded-t-xl">
        <Thumbnail
          name={preview.title}
          uri={preview.imageUrl}
          aspectRatio={4 / 3}
          radius={0}
          icon={preview.contextIcon}
        />

        {/* Scrim, so the title stays readable over a bright photo. */}
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{ backgroundColor: 'rgba(26, 21, 18, 0.55)' }}
        />

        <View className="absolute inset-x-0 bottom-0 flex-row items-end justify-between gap-2 p-3">
          <View className="min-w-0 flex-1">
            <Txt variant="title" numberOfLines={2} style={{ color: '#FFFFFF' }} serif>
              {preview.title}
            </Txt>
            {preview.context ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Ionicons name={preview.contextIcon} size={12} color="rgba(255,255,255,0.75)" />
                <Txt
                  variant="caption"
                  numberOfLines={1}
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {preview.context}
                </Txt>
              </View>
            ) : null}
          </View>

          {preview.rating ? (
            <View
              className="flex-row items-center gap-1 rounded-pill px-2 py-1"
              style={{ backgroundColor: 'rgba(26, 21, 18, 0.6)' }}
            >
              <Ionicons name="star" size={12} color={colors.accent} />
              <Txt variant="overline" weight="bold" serif={false} style={{ color: '#FFFFFF' }}>
                {preview.rating}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>

      <View className="gap-2.5 p-3.5">
        <View className="flex-row items-center gap-2">
          <Chip label={preview.kindLabel} tone="primary" />
          {preview.rating ? (
            <RatingStars value={preview.rating} size={14} gap={1} readOnly />
          ) : null}
        </View>

        {preview.comments ? (
          <Txt variant="callout" tone="muted" numberOfLines={4}>
            {preview.comments}
          </Txt>
        ) : null}

        {preview.tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {preview.tags.map((tag) => (
              <Tag key={tag.id} name={tag.name} color={tag.color} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
