import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { fetchNotifications, markNotificationsRead } from '@/features/social/api';
import type { AppNotification } from '@/features/social/api';
import { AuthorHeader } from '@/features/social/components/AuthorHeader';
import { usePagedResource } from '@/features/social/hooks/usePagedResource';
import { remoteImageUri } from '@/features/social/remote-image';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { formatRelativeDate } from '@/lib/helpers/date';

/**
 * Novedades.
 *
 * Una lista, no una bandeja que haya que vaciar: entrar aquí ya es haberlas
 * visto, así que se marcan leídas al abrir y el punto se apaga solo. Pedir
 * además que descartes cada línea sería convertir un aviso en una tarea.
 *
 * Lo leído no se borra. Un aviso viejo sigue siendo la forma más rápida de
 * volver a la comida en la que te etiquetaron hace tres semanas.
 */
export default function NotificationsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const signedIn = Boolean(session);

  const notifications = usePagedResource<AppNotification>(
    (before) => fetchNotifications(before),
    (item) => item.createdAt,
    { enabled: signedIn, pageSize: 30, deps: [session?.user.id] },
  );

  // Al abrir, no al tocar cada una. La pantalla es el acuse de recibo.
  useEffect(() => {
    if (!signedIn) return;
    void markNotificationsRead();
  }, [signedIn]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <NotificationRow notification={item} />,
    [],
  );

  if (!signedIn) {
    return (
      <Screen>
        <EmptyState
          icon="notifications-off-outline"
          title="Inicia sesión para ver tus novedades"
          message="Los avisos llegan de las personas con las que compartes."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={notifications.items}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="px-5 pb-16 pt-3 gap-2.5"
        showsVerticalScrollIndicator={false}
        onEndReached={notifications.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={notifications.loading}
            onRefresh={() => void notifications.reload()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          notifications.loading ? null : (
            <EmptyState
              icon="notifications-outline"
              title="Nada nuevo"
              message="Aquí aparecerán las solicitudes de amistad y lo que compartan tus amigos."
            />
          )
        }
        ListFooterComponent={
          notifications.loadingMore ? (
            <View className="py-5">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

/**
 * Cómo se lee cada clase de aviso.
 *
 * Una función y no cuatro componentes: lo único que cambia entre ellas es la
 * frase. El avatar, la foto, la hora y el punto de no leído son los mismos, y
 * duplicar la fila cuatro veces para cambiar seis palabras es donde se acaban
 * yendo cada una por su lado.
 *
 * Devuelve también la frase en plano porque un lector de pantalla no puede leer
 * el texto compuesto: lo que ve es una lista de trozos con formato.
 */
function describe(kind: AppNotification['kind'], actor: string, place: string | null) {
  switch (kind) {
    case 'tagged_in_visit': {
      // El servidor ya descarta los avisos de visitas borradas, así que aquí
      // siempre hay sitio; el respaldo es para que un fallo suyo no acabe
      // pintando "te etiquetó en null".
      const where = place ?? 'una comida';
      return { verb: ' te etiquetó en ', place: where, plain: `${actor} te etiquetó en ${where}` };
    }
    case 'friend_published':
      // Sin decir qué, a propósito: el aviso resume el sitio, la visita y los
      // platos de una misma comida, y nombrar solo uno de los tres sería
      // nombrar el que ganó la carrera del sync.
      return {
        verb: ' ha añadido algo nuevo',
        place: null,
        plain: `${actor} ha añadido algo nuevo`,
      };
    case 'friend_request':
      return { verb: ' quiere ser tu amigo', place: null, plain: `${actor} quiere ser tu amigo` };
    case 'friend_accepted':
      return {
        verb: ' aceptó tu solicitud de amistad',
        place: null,
        plain: `${actor} aceptó tu solicitud de amistad`,
      };
  }
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const { colors } = useTheme();

  const actor = notification.displayName ?? notification.username ?? 'Alguien';
  const photo = notification.actorId
    ? remoteImageUri(notification.actorId, notification.imageKey)
    : null;
  const unread = notification.readAt === null;
  const said = describe(notification.kind, actor, notification.title);

  /*
   * Dónde lleva el aviso.
   *
   * La visita cuando la trae, y si no el perfil de quien lo provocó: ahí están
   * sus entradas, y ahí se acepta o se rechaza una solicitud pendiente. Un aviso
   * que no lleva a ningún sitio es indistinguible de uno roto, así que el perfil
   * no es un premio de consolación — es el destino correcto para las tres clases
   * que no ocurren en una comida concreta.
   */
  const open = () => {
    if (notification.visitUuid) {
      router.push({
        pathname: '/(main)/shared/[visit]',
        params: { visit: notification.visitUuid },
      });
      return;
    }
    if (notification.actorId) {
      router.push({ pathname: '/(main)/friends/[id]', params: { id: notification.actorId } });
    }
  };

  return (
    <PressableScale
      accessibilityLabel={said.plain}
      onPress={open}
      scaleTo={0.985}
      className={`flex-row items-center gap-3 rounded-xl border p-3 ${
        unread ? 'border-primary/40 bg-primary/8' : 'border-line bg-surface'
      }`}
    >
      <AuthorHeader
        userId={notification.actorId}
        name={actor}
        avatarUrl={notification.avatarUrl}
        size={38}
        trailing={
          photo ? (
            <Thumbnail
              name={said.place ?? 'Una visita'}
              uri={photo}
              size={44}
              radius={10}
              icon="restaurant"
            />
          ) : (
            <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
          )
        }
      >
        <Txt variant="callout" numberOfLines={2}>
          <Txt variant="callout" weight="bold">
            {actor}
          </Txt>
          {said.verb}
          {said.place ? (
            <Txt variant="callout" weight="semi">
              {said.place}
            </Txt>
          ) : null}
        </Txt>
        <Txt variant="caption" tone="subtle">
          {formatRelativeDate(notification.createdAt)}
        </Txt>
      </AuthorHeader>
    </PressableScale>
  );
}
