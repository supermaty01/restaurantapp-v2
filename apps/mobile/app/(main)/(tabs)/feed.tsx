import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { fetchFeed } from '@/features/social/api';
import type { FeedEntry } from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * What friends have been eating.
 *
 * Everything here comes from the server and nothing is cached locally: the feed
 * is other people's data, which the app deliberately does not mirror into the
 * local database (docs/06 — only your own diary lives on the device).
 */
export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, isConfigured } = useAuth();

  const { data, loading, error, reload } = useAsyncResource<FeedEntry[]>(() => fetchFeed(), {
    enabled: Boolean(session),
    deps: [session?.user.id],
  });

  const renderItem = useCallback(({ item }: { item: FeedEntry }) => <FeedCard entry={item} />, []);

  if (!isConfigured) {
    return (
      <Screen>
        <Header />
        <EmptyState
          icon="cloud-offline-outline"
          title="Sin cuenta configurada"
          message="Esta copia de la app funciona solo en local. El feed necesita una cuenta en la nube."
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <Header />
        <EmptyState
          icon="people-outline"
          title="Inicia sesión para ver a tus amigos"
          message="Tu diario seguirá siendo tuyo: solo se comparte lo que marques como visible."
          action={<Button label="Iniciar sesión" onPress={() => router.push('/(main)/account')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View className="px-5">
        <Header />
      </View>

      {loading && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
          renderItem={renderItem}
          contentContainerClassName="px-5 pb-28 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={reload}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            error ? (
              <View className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
                <Text className="text-[13px] text-danger">{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="people-outline"
                title="Todavía no hay nada por aquí"
                message="Cuando tus amigos compartan una visita o un plato, aparecerá aquí."
                action={
                  <Button
                    label="Buscar amigos"
                    icon="person-add-outline"
                    onPress={() => router.push('/(main)/friends/search')}
                  />
                }
              />
            )
          }
        />
      )}
    </Screen>
  );
}

function Header() {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between pb-3 pt-3.5">
      <Text className="font-display text-[26px] text-ink">Feed</Text>
      <Button
        label="Amigos"
        icon="people-outline"
        variant="secondary"
        size="sm"
        onPress={() => router.push('/(main)/friends')}
      />
    </View>
  );
}
