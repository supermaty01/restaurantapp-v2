import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import {
  fetchUserEntries,
  fetchUserProfile,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/features/social/api';
import type { FeedEntry, FriendshipState, PublicProfile } from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';


/**
 * Someone else's profile.
 *
 * How much of it fills in is decided by the server, not here: a stranger sees
 * a name and whatever is public, a friend sees the friends-only entries and the
 * bio. The client never filters the response — doing that would mean the data
 * had already been sent.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const profile = useAsyncResource<PublicProfile | null>(() => fetchUserProfile(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  const entries = useAsyncResource<FeedEntry[]>(() => fetchUserEntries(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  const act = useCallback(
    async (action: () => Promise<FriendshipState>, failure: string) => {
      setBusy(true);
      try {
        await action();
        await Promise.all([profile.reload(), entries.reload()]);
      } catch (error) {
        reportError(failure, error);
      } finally {
        setBusy(false);
      }
    },
    [profile, entries],
  );

  if (profile.loading && !profile.data) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <Screen>
        <EmptyState
          icon="person-outline"
          title="No se pudo cargar el perfil"
          {...(profile.error ? { message: profile.error } : {})}
          action={<Button label="Reintentar" onPress={profile.reload} />}
        />
      </Screen>
    );
  }

  const user = profile.data;
  const name = user.displayName ?? user.username;

  return (
    <Screen padded={false}>
      <FlatList
        data={entries.data ?? []}
        keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
        renderItem={({ item }) => <FeedCard entry={item} />}
        contentContainerClassName="px-5 pb-8 gap-3"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={entries.loading}
            onRefresh={entries.reload}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="pb-2">
            <Card className="items-center gap-3 py-5">
              <Avatar name={name} uri={user.avatarUrl} size={72} />
              <View className="items-center">
                <Text className="font-display text-[22px] text-ink">{name}</Text>
                <Text className="text-[13px] text-ink-subtle">@{user.username}</Text>
              </View>

              {user.bio ? (
                <Text className="px-4 text-center text-[14px] leading-5 text-ink-muted">
                  {user.bio}
                </Text>
              ) : null}

              <View className="flex-row gap-6">
                <Counter value={user.sharedCount} label="visitas" />
                <Counter value={user.friendCount} label="amigos" />
              </View>

              <RelationshipAction
                state={user.state}
                busy={busy}
                onAdd={() => act(() => sendFriendRequest(user.userId), 'No se pudo enviar')}
                onAccept={() =>
                  act(() => respondFriendRequest(user.userId, true), 'No se pudo aceptar')
                }
                onDecline={() =>
                  act(() => respondFriendRequest(user.userId, false), 'No se pudo rechazar')
                }
                onRemove={() => act(() => removeFriend(user.userId), 'No se pudo quitar')}
              />
            </Card>
          </View>
        }
        ListEmptyComponent={
          entries.loading ? null : (
            <EmptyState
              icon="albums-outline"
              title={
                user.state === 'friends' ? 'Todavía no ha compartido nada' : 'Nada público por aquí'
              }
              message={
                user.state === 'friends'
                  ? 'Cuando comparta una visita o un plato, aparecerá aquí.'
                  : 'Si os hacéis amigos podrás ver lo que comparta con sus amigos.'
              }
            />
          )
        }
      />
    </Screen>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center">
      <Text className="font-display text-[22px] text-ink">{value}</Text>
      <Text className="text-[12px] text-ink-subtle">{label}</Text>
    </View>
  );
}

function RelationshipAction({
  state,
  busy,
  onAdd,
  onAccept,
  onDecline,
  onRemove,
}: {
  state: FriendshipState;
  busy: boolean;
  onAdd: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
}) {
  if (state === 'self') return null;

  if (state === 'request_received') {
    return (
      <View className="w-full flex-row gap-2.5">
        <View className="flex-1">
          <Button label="Rechazar" variant="secondary" block disabled={busy} onPress={onDecline} />
        </View>
        <View className="flex-1">
          <Button label="Aceptar" block disabled={busy} onPress={onAccept} />
        </View>
      </View>
    );
  }

  if (state === 'request_sent') {
    return (
      <Button
        label="Cancelar solicitud"
        variant="secondary"
        block
        disabled={busy}
        onPress={onRemove}
      />
    );
  }

  if (state === 'friends') {
    return (
      <Button label="Quitar de amigos" variant="ghost" block disabled={busy} onPress={onRemove} />
    );
  }

  return (
    <Button
      label="Añadir a amigos"
      icon="person-add-outline"
      block
      disabled={busy}
      onPress={onAdd}
    />
  );
}
