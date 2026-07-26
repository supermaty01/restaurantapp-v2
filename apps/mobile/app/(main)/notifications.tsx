import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { fetchNotifications, markNotificationsRead } from '@/features/social/api';
import type { AppNotification } from '@/features/social/api';
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
              message="Aquí aparecerá cuando alguien te etiquete en una comida."
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

function NotificationRow({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const { colors } = useTheme();

  const actor = notification.displayName ?? notification.username ?? 'Alguien';
  const photo = notification.actorId
    ? remoteImageUri(notification.actorId, notification.imageKey)
    : null;
  const unread = notification.readAt === null;

  return (
    <PressableScale
      accessibilityLabel={`${actor} te etiquetó en ${notification.title}`}
      onPress={() => {
        if (!notification.visitUuid) return;
        router.push({
          pathname: '/(main)/shared/[visit]',
          params: { visit: notification.visitUuid },
        });
      }}
      scaleTo={0.985}
      className={`flex-row items-center gap-3 rounded-xl border p-3 ${
        unread ? 'border-primary/40 bg-primary/8' : 'border-line bg-surface'
      }`}
    >
      <Avatar name={actor} uri={notification.avatarUrl} size={38} />

      <View className="min-w-0 flex-1 gap-0.5">
        <Txt variant="callout" numberOfLines={2}>
          <Txt variant="callout" weight="bold">
            {actor}
          </Txt>
          {' te etiquetó en '}
          <Txt variant="callout" weight="semi">
            {notification.title}
          </Txt>
        </Txt>
        <Txt variant="caption" tone="subtle">
          {formatRelativeDate(notification.createdAt)}
        </Txt>
      </View>

      {photo ? (
        <Thumbnail name={notification.title} uri={photo} size={44} radius={10} icon="restaurant" />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
      )}
    </PressableScale>
  );
}
