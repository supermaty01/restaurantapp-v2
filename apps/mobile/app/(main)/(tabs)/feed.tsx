import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { fetchFeed, fetchTaggedVisits } from '@/features/social/api';
import type { FeedEntry, TaggedVisit } from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';
import { TaggedVisitCard } from '@/features/social/components/TaggedVisitCard';
import { usePagedResource } from '@/features/social/hooks/usePagedResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * What friends have been eating, and what you were part of.
 *
 * Two lists behind one tab rather than two tabs, because they answer the same
 * question from different sides and the app already had too many sections. They
 * stay separate lists, though: a visit someone tagged you in is *their* record
 * of *your* evening, and merging it into a stream you scroll past would bury
 * the one thing here addressed to you.
 *
 * Nothing is cached locally. This is other people's data, which the app
 * deliberately does not mirror into the diary (docs/06) — your device holds
 * what you wrote, and nothing else.
 */
type Tab = 'friends' | 'tagged';

export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, isConfigured } = useAuth();
  const [tab, setTab] = useState<Tab>('friends');

  const signedIn = Boolean(session);

  const friends = usePagedResource<FeedEntry>(
    (before) => fetchFeed(before),
    (entry) => entry.occurredAt,
    { enabled: signedIn, deps: [session?.user.id] },
  );

  const tagged = usePagedResource<TaggedVisit>(
    (before) => fetchTaggedVisits(before),
    (visit) => visit.occurredAt,
    { enabled: signedIn, deps: [session?.user.id] },
  );

  const active = tab === 'friends' ? friends : tagged;

  const renderFriendItem = useCallback(
    ({ item }: { item: FeedEntry }) => <FeedCard entry={item} />,
    [],
  );
  const renderTaggedItem = useCallback(
    ({ item }: { item: TaggedVisit }) => <TaggedVisitCard visit={item} />,
    [],
  );

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

  const empty =
    tab === 'friends' ? (
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
    ) : (
      <EmptyState
        icon="pricetag-outline"
        title="Nadie te ha etiquetado aún"
        message="Cuando alguien te añada a una comida que comparte, la verás aquí sin que se mezcle con tu diario."
      />
    );

  return (
    <Screen padded={false}>
      <View className="px-5">
        <Header />
        <Tabs value={tab} onChange={setTab} taggedCount={tagged.items.length} />
      </View>

      {active.loading && active.items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tab === 'friends' ? (
        <FlatList
          data={friends.items}
          keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
          renderItem={renderFriendItem}
          contentContainerClassName="px-5 pb-28 gap-3"
          showsVerticalScrollIndicator={false}
          onEndReached={friends.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={friends.loading}
              onRefresh={friends.reload}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={<ErrorNote message={friends.error} />}
          ListFooterComponent={<Footer loading={friends.loadingMore} />}
          ListEmptyComponent={friends.error ? null : empty}
        />
      ) : (
        <FlatList
          data={tagged.items}
          keyExtractor={(item) => item.entityUuid}
          renderItem={renderTaggedItem}
          contentContainerClassName="px-5 pb-28 gap-3"
          showsVerticalScrollIndicator={false}
          onEndReached={tagged.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={tagged.loading}
              onRefresh={tagged.reload}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={<ErrorNote message={tagged.error} />}
          ListFooterComponent={<Footer loading={tagged.loadingMore} />}
          ListEmptyComponent={tagged.error ? null : empty}
        />
      )}
    </Screen>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
      <Text className="text-[13px] text-danger">{message}</Text>
    </View>
  );
}

/** The spinner lives at the end, where the next page will appear. */
function Footer({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <View className="py-5">
      <ActivityIndicator />
    </View>
  );
}

function Tabs({
  value,
  onChange,
  taggedCount,
}: {
  value: Tab;
  onChange: (next: Tab) => void;
  taggedCount: number;
}) {
  const options: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends', label: 'Amigos' },
    // The count only when there is something, so an empty tray does not wear a
    // zero like a notification you cannot clear.
    { key: 'tagged', label: 'Contigo', ...(taggedCount > 0 ? { badge: taggedCount } : {}) },
  ];

  return (
    <View className="mb-3 flex-row gap-2">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <PressableScale
            key={option.key}
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            scaleTo={0.95}
            className={`rounded-pill px-4 py-2 ${
              selected ? 'bg-primary' : 'border border-line-strong bg-surface'
            }`}
          >
            <Txt
              variant="caption"
              weight={selected ? 'bold' : 'semi'}
              serif={false}
              tone={selected ? 'onPrimary' : 'muted'}
            >
              {option.label}
              {option.badge ? ` · ${option.badge}` : ''}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
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
