import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { PressableScale } from '@/components/ui/Motion';
import { Card, Chip } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatRelativeDate } from '@/lib/helpers/date';
import { remoteImageUri } from '@/lib/helpers/remote-image';

import { companionsLabel } from '../companions';
import { AuthorHeader } from './AuthorHeader';
import { LikeButton } from './LikeButton';

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
  const companions = companionsLabel(entry.companionNames, entry.companionCount);

  const body = (
    <Card className="gap-3">
      <AuthorHeader
        userId={entry.authorId}
        name={author}
        avatarUrl={entry.avatarUrl}
        trailing={<Ionicons name={icon[entry.kind]} size={16} color={colors.inkSubtle} />}
      >
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
      </AuthorHeader>

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
        {companions ? (
          <View className="min-w-0 flex-1 flex-row items-center gap-1">
            <Ionicons name="people-outline" size={12} color={colors.inkSubtle} />
            <Txt variant="caption" tone="subtle" numberOfLines={1} className="flex-1">
              {companions}
            </Txt>
          </View>
        ) : null}
        {/* El corazón, al final de la fila y siempre a la derecha: es lo único
            de la tarjeta que se toca por sí solo, así que tiene que estar en el
            mismo sitio en todas — con la compañía o sin ella. */}
        <View className={companions ? '' : 'flex-1 items-end'}>
          <LikeButton
            entityUuid={entry.entityUuid}
            kind={entry.kind}
            count={entry.likeCount}
            liked={entry.likedByMe}
          />
        </View>
      </View>
    </Card>
  );

  return (
    <PressableScale
      accessibilityLabel={`${OPEN_LABEL[entry.kind]} de ${author}: ${entry.title}`}
      onPress={() => open(router, entry)}
      scaleTo={0.985}
    >
      {body}
    </PressableScale>
  );
}

/**
 * Las tres clases se abren, desde la migración 0025.
 *
 * Antes solo la visita: un plato o un sitio compartidos sueltos no tenían
 * detrás ninguna pantalla, así que la tarjeta se quedaba inerte antes que
 * ofrecer un toque que no lleva a ninguna parte. Ahora la tienen las tres, y la
 * inercia sería la que sobra — una tarjeta con foto y nota que no se abre es lo
 * que se toca dos veces antes de darse por vencido.
 *
 * Y una tarjeta del feed siempre se puede abrir: está ahí porque el servidor ya
 * decidió que quien mira puede verla, que es exactamente la comprobación que
 * hacen `dish_detail` y `restaurant_detail` al llegar. (No es así dentro del
 * detalle de una visita, donde sí hacía falta un `canOpen` — ver
 * `shared/[visit].tsx`.)
 */
const OPEN_LABEL: Record<FeedKind, string> = {
  visit: 'Ver la visita',
  dish: 'Ver el plato',
  restaurant: 'Ver el sitio',
};

function open(router: ReturnType<typeof useRouter>, entry: FeedEntry): void {
  switch (entry.kind) {
    case 'visit':
      router.push({ pathname: '/(main)/shared/[visit]', params: { visit: entry.entityUuid } });
      return;
    case 'dish':
      router.push({ pathname: '/(main)/shared/dish/[id]', params: { id: entry.entityUuid } });
      return;
    case 'restaurant':
      router.push({ pathname: '/(main)/shared/restaurant/[id]', params: { id: entry.entityUuid } });
      return;
  }
}
