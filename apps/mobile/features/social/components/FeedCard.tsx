import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { Avatar } from '@/components/ui/Avatar';
import { Card, Chip } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatRelativeDate } from '@/lib/helpers/date';

import { remoteImageUri } from '../remote-image';

import type { FeedEntry, FeedKind } from '../api';

/** What a friend did, phrased as a sentence rather than a table row. */
const verb: Record<FeedKind, string> = {
  visit: 'estuvo en',
  dish: 'probó',
  restaurant: 'descubrió',
};

const icon: Record<FeedKind, React.ComponentProps<typeof Ionicons>['name']> = {
  visit: 'restaurant',
  dish: 'fast-food',
  restaurant: 'location',
};

export function FeedCard({ entry }: { entry: FeedEntry }) {
  const { colors } = useTheme();
  const author = entry.displayName ?? entry.username;
  const photo = remoteImageUri(entry.authorId, entry.imageKey);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={author} uri={entry.avatarUrl} size={34} />
        <View className="flex-1">
          <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
            <Text className="font-bold text-ink">{author}</Text> {verb[entry.kind]}{' '}
            <Text className="font-semi text-ink">{entry.title}</Text>
          </Text>
          <Text className="text-[11px] text-ink-subtle">
            {formatRelativeDate(entry.occurredAt)}
            {entry.place && entry.place !== entry.title ? ` · ${entry.place}` : ''}
          </Text>
        </View>
        <Ionicons name={icon[entry.kind]} size={16} color={colors.inkSubtle} />
      </View>

      {photo ? (
        <Image
          source={photo}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 11 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={photo}
          transition={150}
        />
      ) : (
        <Thumbnail name={entry.title} aspectRatio={4 / 3} icon={icon[entry.kind]} radius={11} />
      )}

      {entry.comments ? (
        <Text className="text-[14px] leading-5 text-ink-muted" numberOfLines={3}>
          {entry.comments}
        </Text>
      ) : null}

      {entry.rating ? (
        <View className="flex-row items-center gap-2">
          <RatingStars value={entry.rating} readOnly size={15} gap={2} />
        </View>
      ) : null}

      {entry.kind === 'dish' && entry.place ? (
        <View className="flex-row">
          <Chip label={entry.place} tone="sage" />
        </View>
      ) : null}
    </Card>
  );
}
