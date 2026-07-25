import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import RatingStars from '@/components/RatingStars';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { fetchSharedVisit, type SharedVisit } from '@/features/social/api';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { remoteImageUri } from '@/features/social/remote-image';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatVisitDate } from '@/lib/helpers/date';

/**
 * Someone else's meal.
 *
 * A read-only screen on purpose, and visibly not the same thing as your own
 * visit detail: there is nothing to edit, nothing to delete, and the restaurant
 * does not link anywhere because it is not in your diary. Making it look like
 * your own screen would invite taps that cannot work.
 *
 * Everything comes from one RPC. The restaurant and the dishes arrive even when
 * their owner keeps them private — a shared meal that cannot say where it was
 * or what was eaten is not shared at all (0011).
 */
export default function SharedVisitScreen() {
  const { visit: visitUuid } = useGlobalSearchParams<{ visit: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, loading, error } = useAsyncResource<SharedVisit | null>(
    () => fetchSharedVisit(String(visitUuid)),
    { enabled: Boolean(session && visitUuid), deps: [visitUuid, session?.user.id] },
  );

  if (loading && !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="No se puede ver esta visita"
          // Deliberately the same message whether it was deleted, never existed
          // or is simply not shared with you: a diary that tells you which is
          // a diary that tells strangers what someone has written.
          message="Puede que ya no esté compartida o que no tengas acceso."
          action={<Button label="Volver" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const author = data.author.displayName ?? data.author.username;
  const cover = remoteImageUri(data.author.userId, data.images[0] ?? null);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-3 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <PressableScale
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            scaleTo={0.9}
            className="h-9 w-9 items-center justify-center rounded-pill bg-sunken"
          >
            <Ionicons name="chevron-back" size={19} color={colors.ink} />
          </PressableScale>
          <Txt variant="caption" tone="subtle" className="flex-1">
            Visita compartida
          </Txt>
        </View>

        {cover ? (
          <Image
            source={cover}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <Thumbnail
            name={data.restaurant?.name ?? 'Una visita'}
            aspectRatio={4 / 3}
            icon="restaurant"
            radius={16}
          />
        )}

        <View className="gap-1">
          <Txt variant="title">{data.restaurant?.name ?? 'Una visita'}</Txt>
          <Txt variant="caption" tone="subtle">
            {formatVisitDate(data.visitedAt)}
          </Txt>
        </View>

        <PressableScale
          accessibilityLabel={`Ver el perfil de ${author}`}
          onPress={() =>
            router.push({ pathname: '/(main)/friends/[id]', params: { id: data.author.userId } })
          }
          scaleTo={0.985}
          className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3"
        >
          <Avatar name={author} uri={data.author.avatarUrl} size={38} />
          <View className="flex-1">
            <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
              {author}
            </Txt>
            <Txt variant="caption" tone="subtle">
              @{data.author.username}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
        </PressableScale>

        {data.comments ? (
          <Card>
            <Txt variant="body" tone="muted">
              {data.comments}
            </Txt>
          </Card>
        ) : null}

        {data.people.length > 0 ? (
          <View className="gap-2">
            <Txt variant="caption" tone="subtle">
              Con quién
            </Txt>
            <View className="flex-row flex-wrap gap-2">
              {data.people.map((person) => (
                <View
                  key={person.accountUuid ?? person.name}
                  className="flex-row items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pl-1.5 pr-3.5"
                >
                  <Avatar name={person.name} size={24} />
                  <Txt variant="caption" weight="semi" serif={false}>
                    {person.name}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data.dishes.length > 0 ? (
          <View className="gap-2">
            <Txt variant="caption" tone="subtle">
              Qué comieron
            </Txt>
            {data.dishes.map((dish) => {
              const photo = remoteImageUri(data.author.userId, dish.imageKey);
              return (
                <View
                  key={dish.uuid}
                  className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5"
                >
                  <Thumbnail name={dish.name} uri={photo} size={44} radius={10} icon="fast-food" />
                  <View className="flex-1 gap-0.5">
                    <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
                      {dish.name}
                    </Txt>
                    {dish.rating ? (
                      <RatingStars value={dish.rating} readOnly size={13} gap={2} />
                    ) : null}
                    {dish.comments ? (
                      <Txt variant="caption" tone="subtle" numberOfLines={2}>
                        {dish.comments}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* The rest of the photos, after the content they belong to. */}
        {data.images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {data.images.slice(1).map((key) => (
              <Image
                key={key}
                source={remoteImageUri(data.author.userId, key) ?? null}
                style={{ width: 150, height: 150, borderRadius: 12 }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
