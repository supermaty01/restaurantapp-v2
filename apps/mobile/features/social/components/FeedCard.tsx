import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { Avatar } from '@/components/ui/Avatar';
import { PressableScale } from '@/components/ui/Motion';
import { Card, Chip } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
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

/**
 * Lists what was eaten without turning the card into a list.
 *
 * Two names read as a sentence; past that it becomes a menu nobody scans, so
 * the rest is a count. The card's job is to make you want to open the visit,
 * not to be the visit.
 */
function eaten(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0] ?? null;
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

export function FeedCard({ entry }: { entry: FeedEntry }) {
  const { colors } = useTheme();
  const router = useRouter();
  const author = entry.displayName ?? entry.username;
  const photo = remoteImageUri(entry.authorId, entry.imageKey);
  const dishes = eaten(entry.dishNames);

  // Only a visit has a screen of its own to open. A loose dish or restaurant
  // has no shared detail behind it, so the card stays inert rather than
  // offering a tap that goes nowhere.
  const openable = entry.kind === 'visit';

  const body = (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={author} uri={entry.avatarUrl} size={34} />
        <View className="flex-1">
          {/* Dos líneas: es la frase que dice de qué va la tarjeta, y en una
              sola se cortaba en cuanto el nombre y el sitio pasaban de cortos
              — "Mateo Álvarez estuvo en L'Atelier Artisan Crê…" deja fuera
              justo el dato que se venía a leer. */}
          <Text className="text-[13px] leading-[18px] text-ink-muted" numberOfLines={2}>
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

      {dishes ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="fast-food-outline" size={13} color={colors.sage} />
          <Txt variant="caption" tone="muted" numberOfLines={1} className="flex-1">
            {dishes}
          </Txt>
        </View>
      ) : null}

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

      <View className="flex-row items-center gap-2">
        {entry.kind === 'dish' && entry.place ? <Chip label={entry.place} tone="sage" /> : null}
        {entry.companionCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="people-outline" size={12} color={colors.inkSubtle} />
            <Txt variant="caption" tone="subtle">
              {entry.companionCount === 1
                ? 'con 1 persona'
                : `con ${entry.companionCount} personas`}
            </Txt>
          </View>
        ) : null}
      </View>
    </Card>
  );

  if (!openable) return body;

  return (
    <PressableScale
      accessibilityLabel={`Ver la visita de ${author} a ${entry.title}`}
      onPress={() =>
        router.push({ pathname: '/(main)/shared/[visit]', params: { visit: entry.entityUuid } })
      }
      scaleTo={0.985}
    >
      {body}
    </PressableScale>
  );
}
