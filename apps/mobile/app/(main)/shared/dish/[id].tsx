import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ImageLightbox, type LightboxImage } from '@/components/media/ImageLightbox';
import RatingStars from '@/components/RatingStars';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { formatDishPrice } from '@/features/dishes/currency';
import { fetchSharedDish, type SharedDishDetail } from '@/features/social/api';
import { LikeButton } from '@/features/social/components/LikeButton';
import { SharedAuthorRow, SharedBackBar } from '@/features/social/components/SharedChrome';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { remoteImageUri } from '@/lib/helpers/remote-image';

/**
 * Un plato de otra persona.
 *
 * Antes esto no existía: un plato que un amigo compartía suelto pintaba su
 * tarjeta en el feed y ahí se acababa —`FeedCard` ni siquiera lo hacía
 * pulsable— y dentro de una visita compartida era una línea de texto con la
 * foto recortada a 44 píxeles.
 *
 * De solo lectura y **visiblemente distinta de la tuya**, igual que el detalle
 * de una visita compartida: no hay editar, ni borrar, ni etiquetas, ni control
 * de visibilidad. Parecerse a tu propia pantalla invitaría a tocar cosas que no
 * pueden funcionar.
 *
 * Y no enseña en qué visitas se comió. Poder ver un plato no da acceso al
 * diario de nadie — la decisión de quien lo compartió fue sobre el plato (0011,
 * y la migración 0025 lo vuelve a decir donde se aplica).
 */
export default function SharedDishScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data, loading, error } = useAsyncResource<SharedDishDetail | null>(
    () => fetchSharedDish(String(id)),
    { enabled: Boolean(session && id), deps: [id, session?.user.id] },
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
          title="No se puede ver este plato"
          // El mismo mensaje se haya borrado, no exista o no sea para ti: ver
          // `shared/[visit].tsx`, donde está el razonamiento entero.
          message="Puede que ya no esté compartido o que no tengas acceso."
          action={<Button label="Volver" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const photos: LightboxImage[] = data.images
    .map((key) => ({ key, uri: remoteImageUri(data.author.userId, key) }))
    .filter((photo): photo is { key: string; uri: string } => Boolean(photo.uri))
    .map((photo) => ({ id: photo.key, uri: photo.uri }));

  const price = formatDishPrice(data.price, data.currency);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-3 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <SharedBackBar label="Plato compartido" />

        {photos[0] ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Ver la foto completa"
            onPress={() => setLightboxIndex(0)}
          >
            <Image
              source={photos[0].uri}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </Pressable>
        ) : (
          <Thumbnail name={data.name} aspectRatio={4 / 3} icon="fast-food" radius={16} />
        )}

        <View className="gap-2">
          <Txt variant="title">{data.name}</Txt>
          <View className="flex-row items-center gap-3">
            {data.rating ? <RatingStars value={data.rating} readOnly size={15} gap={2} /> : null}
            {price ? (
              <Txt variant="callout" tone="muted" weight="semi" serif={false}>
                {price}
              </Txt>
            ) : null}
            <View className="flex-1 items-end">
              <LikeButton
                entityUuid={data.uuid}
                kind="dish"
                count={data.likeCount}
                liked={data.likedByMe}
                size="md"
              />
            </View>
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

        {/* El sitio solo lleva a alguna parte si quien lo escribió también lo
            comparte. Sin `canOpen` sería un enlace que el servidor rechaza, que
            desde fuera no se distingue de una avería. */}
        {data.restaurant ? (
          <RestaurantLink
            name={data.restaurant.name}
            {...(data.restaurant.canOpen ? { uuid: data.restaurant.uuid } : {})}
          />
        ) : null}

        {photos.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {photos.slice(1).map((photo, index) => (
              <Pressable
                key={photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel="Ver la foto completa"
                onPress={() => setLightboxIndex(index + 1)}
              >
                <Image
                  source={photo.uri}
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

/** Dónde se comió. Pulsable solo cuando el sitio también está compartido. */
function RestaurantLink({ name, uuid }: { name: string; uuid?: string }) {
  const router = useRouter();
  const { colors } = useTheme();

  const body = (
    <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <View className="h-9 w-9 items-center justify-center rounded-pill bg-sunken">
        <Ionicons name="location-outline" size={17} color={colors.inkMuted} />
      </View>
      <View className="min-w-0 flex-1">
        <Txt variant="caption" tone="subtle">
          Dónde
        </Txt>
        <Txt variant="body" weight="semi" serif={false} numberOfLines={1}>
          {name}
        </Txt>
      </View>
      {uuid ? <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} /> : null}
    </View>
  );

  if (!uuid) return body;

  return (
    <PressableScale
      accessibilityLabel={`Ver ${name}`}
      onPress={() =>
        router.push({ pathname: '/(main)/shared/restaurant/[id]', params: { id: uuid } })
      }
      scaleTo={0.985}
    >
      {body}
    </PressableScale>
  );
}
