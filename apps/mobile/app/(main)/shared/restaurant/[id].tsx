import { Image } from 'expo-image';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ImageLightbox, type LightboxImage } from '@/components/media/ImageLightbox';
import RatingStars from '@/components/RatingStars';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { fetchSharedRestaurant, type SharedRestaurantDetail } from '@/features/social/api';
import { LikeButton } from '@/features/social/components/LikeButton';
import { SharedAuthorRow, SharedBackBar } from '@/features/social/components/SharedChrome';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { remoteImageUri } from '@/lib/helpers/remote-image';

/**
 * Un sitio de otra persona.
 *
 * Es el sitio, **no su historial**: ni las visitas que hubo allí ni los platos
 * que se comieron. Poder ver un restaurante no es poder leer el diario de
 * nadie, que es la mitad de la regla de 0011 que no se afloja — la
 * transitividad va de la visita hacia su contenido, nunca al revés.
 *
 * Así que lo que hay aquí es lo que su dueño escribió sobre el sitio: el
 * nombre, su nota, sus comentarios y sus fotos. Si eso parece poco, es que la
 * pantalla está diciendo la verdad sobre cuánto se comparte.
 */
export default function SharedRestaurantScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data, loading, error } = useAsyncResource<SharedRestaurantDetail | null>(
    () => fetchSharedRestaurant(String(id)),
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
          title="No se puede ver este sitio"
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

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-3 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <SharedBackBar label="Sitio compartido" />

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
          <Thumbnail name={data.name} aspectRatio={4 / 3} icon="location" radius={16} />
        )}

        <View className="gap-2">
          <Txt variant="title">{data.name}</Txt>
          <View className="flex-row items-center gap-3">
            {data.rating ? <RatingStars value={data.rating} readOnly size={15} gap={2} /> : null}
            <View className="flex-1 items-end">
              <LikeButton
                entityUuid={data.uuid}
                kind="restaurant"
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

        {/* Sin coordenadas no hay nada que situar, y una tarjeta de mapa vacía
            se lee como que el mapa está roto. */}
        {data.latitude !== null && data.longitude !== null ? (
          <Txt variant="caption" tone="subtle">
            {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
          </Txt>
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
