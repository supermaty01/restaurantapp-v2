import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ImageLightbox, type LightboxImage } from '@/components/media/ImageLightbox';
import RatingStars from '@/components/RatingStars';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { formatDishPrice } from '@/features/dishes/currency';
import {
  fetchSharedVisit,
  rejectTag,
  type SharedDish,
  type SharedVisit,
} from '@/features/social/api';
import { LikeButton } from '@/features/social/components/LikeButton';
import { SharedAuthorRow, SharedBackBar } from '@/features/social/components/SharedChrome';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatVisitDate } from '@/lib/helpers/date';
import { remoteImageUri } from '@/lib/helpers/remote-image';

/**
 * Someone else's meal.
 *
 * A read-only screen on purpose, and visibly not the same thing as your own
 * visit detail: there is nothing to edit and nothing to delete. Making it look
 * like your own screen would invite taps that cannot work.
 *
 * ## El sitio y los platos sí llevan a alguna parte (0025)
 *
 * Y antes no: eran texto, con la foto del plato recortada a 44 píxeles y sin
 * forma de ver el precio ni el comentario entero. Ahora abren su propia
 * pantalla — **cuando su dueño los comparte también sueltos**, que es lo que
 * dice `canOpen`. La diferencia importa porque este detalle enseña platos y un
 * restaurante que pueden ser privados: viajan dentro de la visita porque una
 * comida que no dice dónde fue ni qué se comió no comparte nada (0011), y eso
 * no los convierte en entradas abiertas del diario de nadie. Sin `canOpen` la
 * pantalla ofrecería un toque que el servidor va a rechazar.
 *
 * Everything comes from one RPC.
 */
export default function SharedVisitScreen() {
  const { visit: visitUuid } = useGlobalSearchParams<{ visit: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { ask, tell } = useDialog();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const cover = remoteImageUri(data.author.userId, data.images[0] ?? null);
  const taggedMe = data.people.some((person) => person.accountUuid === session?.user.id);

  /*
   * Un solo carrete para toda la pantalla: primero las fotos de la visita y
   * después las de los platos.
   *
   * Estar compartida no cambia lo que es una foto. Aquí se veían recortadas a
   * 4:3 o a un cuadrado de 150 y no había forma de verlas enteras, mientras que
   * en tu propio diario sí — la misma foto se comportaba distinto según quién la
   * hubiera hecho. Al ir todas en la misma lista se puede además deslizar entre
   * ellas en vez de salir y volver a entrar.
   */
  const photos: LightboxImage[] = [
    ...data.images.map((key) => ({ key, uri: remoteImageUri(data.author.userId, key) })),
    ...data.dishes.map((dish) => ({
      key: `${dish.uuid}-photo`,
      uri: remoteImageUri(data.author.userId, dish.imageKey),
    })),
  ]
    .filter((photo): photo is { key: string; uri: string } => Boolean(photo.uri))
    .map((photo) => ({ id: photo.key, uri: photo.uri }));

  /** Dónde cae una foto en el carrete, por su clave. */
  const photoIndex = (key: string | null) =>
    key === null ? -1 : photos.findIndex((photo) => photo.id === key);

  const openPhoto = (key: string | null) => {
    const index = photoIndex(key);
    if (index >= 0) setLightboxIndex(index);
  };

  async function removeMe() {
    const confirmed = await ask({
      title: 'Quitarte de esta visita',
      message:
        'Dejará de aparecerte y perderás el acceso. No se borra nada del diario de quien te etiquetó.',
      icon: 'person-remove-outline',
      confirmLabel: 'Quitarme',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      await rejectTag(data!.uuid);
      router.back();
    } catch (cause) {
      await tell({
        title: 'No se pudo quitar',
        message: cause instanceof Error ? cause.message : 'Inténtalo de nuevo',
        icon: 'alert-circle-outline',
        destructive: true,
      });
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-3 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <SharedBackBar label="Visita compartida" />

        {cover ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Ver la foto completa"
            onPress={() => openPhoto(data.images[0] ?? null)}
          >
            <Image
              source={cover}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </Pressable>
        ) : (
          <Thumbnail
            name={data.restaurant?.name ?? 'Una visita'}
            aspectRatio={4 / 3}
            icon="restaurant"
            radius={16}
          />
        )}

        <View className="gap-1">
          {/* El nombre del sitio abre el sitio, cuando su dueño también lo
              comparte. El título y no un botón aparte: es el único elemento de
              la pantalla que ya *es* el restaurante. */}
          {data.restaurant && data.restaurant.canOpen ? (
            <PressableScale
              accessibilityLabel={`Ver ${data.restaurant.name}`}
              onPress={() =>
                router.push({
                  pathname: '/(main)/shared/restaurant/[id]',
                  params: { id: data.restaurant?.uuid ?? '' },
                })
              }
              scaleTo={0.99}
              className="flex-row items-center gap-2"
            >
              <Txt variant="title" tone="primary" className="flex-1">
                {data.restaurant.name}
              </Txt>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </PressableScale>
          ) : (
            <Txt variant="title">{data.restaurant?.name ?? 'Una visita'}</Txt>
          )}
          <View className="flex-row items-center justify-between">
            <Txt variant="caption" tone="subtle">
              {formatVisitDate(data.visitedAt)}
            </Txt>
            <LikeButton
              entityUuid={data.uuid}
              kind="visit"
              count={data.likeCount}
              liked={data.likedByMe}
              size="md"
            />
          </View>
        </View>

        <SharedAuthorRow author={data.author} />

        {data.comments ? (
          <Card>
            <Txt variant="body" tone="muted">
              {data.comments}
            </Txt>
          </Card>
        ) : null}

        {/* Only when you are in the guest list. Being tagged is done to you,
            so undoing it belongs on the visit itself, not buried in settings.
            It removes nothing from their diary — the tag stays written where
            they wrote it and simply stops reaching you. */}
        {taggedMe ? (
          <PressableScale
            accessibilityLabel="Quitarme de esta visita"
            onPress={() => void removeMe()}
            scaleTo={0.97}
            className="flex-row items-center justify-center gap-2 rounded-pill border border-line-strong px-4 py-2.5"
          >
            <Ionicons name="person-remove-outline" size={15} color={colors.inkMuted} />
            <Txt variant="caption" weight="semi" serif={false} tone="muted">
              Quitarme de esta visita
            </Txt>
          </PressableScale>
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
            {data.dishes.map((dish) => (
              <SharedDishRow
                key={dish.uuid}
                dish={dish}
                authorId={data.author.userId}
                onOpenPhoto={() => openPhoto(`${dish.uuid}-photo`)}
              />
            ))}
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
              <Pressable
                key={key}
                accessibilityRole="imagebutton"
                accessibilityLabel="Ver la foto completa"
                onPress={() => openPhoto(key)}
              >
                <Image
                  source={remoteImageUri(data.author.userId, key) ?? null}
                  style={{ width: 150, height: 150, borderRadius: 12 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>

      <ImageLightbox
        images={photos}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </Screen>
  );
}

/**
 * Un plato dentro de la comida.
 *
 * Dos gestos distintos sobre la misma fila, y por eso la miniatura conserva el
 * suyo: tocar la foto la abre a pantalla completa —que es lo que se venía
 * haciendo y sigue valiendo aunque el plato no se pueda abrir— y tocar el resto
 * de la fila abre el plato, si es que se puede.
 */
function SharedDishRow({
  dish,
  authorId,
  onOpenPhoto,
}: {
  dish: SharedDish;
  authorId: string;
  onOpenPhoto: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const photo = remoteImageUri(authorId, dish.imageKey);
  const price = formatDishPrice(dish.price, dish.currency);

  const thumbnail = photo ? (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`Ver la foto de ${dish.name}`}
      onPress={onOpenPhoto}
    >
      <Thumbnail name={dish.name} uri={photo} size={44} radius={10} icon="fast-food" />
    </Pressable>
  ) : (
    <Thumbnail name={dish.name} size={44} radius={10} icon="fast-food" />
  );

  const details = (
    <View className="min-w-0 flex-1 gap-0.5">
      <View className="flex-row items-center gap-2">
        <Txt variant="body" weight="semi" serif={false} numberOfLines={1} className="flex-1">
          {dish.name}
        </Txt>
        {price ? (
          <Txt variant="caption" tone="subtle">
            {price}
          </Txt>
        ) : null}
      </View>
      {dish.rating ? <RatingStars value={dish.rating} readOnly size={13} gap={2} /> : null}
      {dish.comments ? (
        <Txt variant="caption" tone="subtle" numberOfLines={2}>
          {dish.comments}
        </Txt>
      ) : null}
    </View>
  );

  if (!dish.canOpen) {
    return (
      <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
        {thumbnail}
        {details}
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      {thumbnail}
      <PressableScale
        accessibilityLabel={`Ver ${dish.name}`}
        onPress={() =>
          router.push({ pathname: '/(main)/shared/dish/[id]', params: { id: dish.uuid } })
        }
        scaleTo={0.99}
        className="min-w-0 flex-1 flex-row items-center gap-2"
      >
        {details}
        <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />
      </PressableScale>
    </View>
  );
}
