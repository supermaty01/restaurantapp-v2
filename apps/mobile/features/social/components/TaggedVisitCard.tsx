import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { PressableScale } from '@/components/ui/Motion';
import { Card } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatVisitDate } from '@/lib/helpers/date';

import { companionsLabel } from '../companions';
import { remoteImageUri } from '../remote-image';
import { AuthorHeader } from './AuthorHeader';

import type { TaggedVisit } from '../api';

/**
 * A meal someone says you were at.
 *
 * Phrased in the second person — "te etiquetó" — because that is what makes it
 * different from a feed card. The feed is things that happened; this is things
 * that happened *to you*, and reading it in the same voice as the rest would
 * lose the only reason it has its own list.
 *
 * The date shown is the day of the meal, not when it was posted: you are being
 * reminded of an evening you were part of, and "hace 3 h" answers a question
 * nobody asked.
 */
export function TaggedVisitCard({ visit }: { visit: TaggedVisit }) {
  const { colors } = useTheme();
  const router = useRouter();
  const author = visit.displayName ?? visit.username;
  const photo = remoteImageUri(visit.authorId, visit.imageKey);

  // Tú eres uno de ellos, así que la línea habla de los demás. Los nombres los
  // filtra ya el servidor (0018): quien mira no se lista a sí misma.
  const companions = companionsLabel(visit.companionNames, Math.max(visit.companionCount - 1, 0));

  return (
    <PressableScale
      accessibilityLabel={`Ver la visita a ${visit.title} en la que ${author} te etiquetó`}
      onPress={() =>
        router.push({ pathname: '/(main)/shared/[visit]', params: { visit: visit.entityUuid } })
      }
      scaleTo={0.985}
    >
      <Card className="gap-3">
        <AuthorHeader
          userId={visit.authorId}
          name={author}
          avatarUrl={visit.avatarUrl}
          trailing={<Ionicons name="pricetag" size={15} color={colors.sage} />}
        >
          {/* Dos líneas, como en el feed: la frase lleva un nombre y el sitio
              donde comisteis, y en una sola se corta justo en el sitio —
              "Caro te etiquetó en L'Atelier Artisan Crê…". */}
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            <Txt variant="caption" weight="bold" serif={false}>
              {author}
            </Txt>{' '}
            te etiquetó en{' '}
            <Txt variant="caption" weight="semi" serif={false}>
              {visit.title}
            </Txt>
          </Txt>
          <Txt variant="caption" tone="subtle">
            {formatVisitDate(visit.visitedAt)}
            {companions ? ` · ${companions}` : ''}
          </Txt>
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
          <Thumbnail name={visit.title} aspectRatio={4 / 3} icon="restaurant" radius={11} />
        )}

        {visit.comments ? (
          <Txt variant="body" tone="muted" numberOfLines={3}>
            {visit.comments}
          </Txt>
        ) : null}
      </Card>
    </PressableScale>
  );
}
