import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { searchUsers, sendFriendRequest } from '@/features/social/api';
import type { UserSummary } from '@/features/social/api';
import { UserRow } from '@/features/social/components/UserRow';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';

/** Below this the server returns nothing, so don't spend a request on it. */
const MIN_QUERY = 2;

export default function FriendSearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Debounced: typing a username would otherwise fire a request per keystroke.
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchUsers(term)
        .then((found) => {
          if (!cancelled) {
            setResults(found);
            setSearched(true);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) reportError('No se pudo buscar', error);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const add = useCallback(async (userId: string) => {
    setPending(userId);
    // Optimistic: the row's button must react to the tap immediately.
    setResults((current) =>
      current.map((u) => (u.userId === userId ? { ...u, state: 'request_sent' } : u)),
    );
    try {
      const state = await sendFriendRequest(userId);
      setResults((current) => current.map((u) => (u.userId === userId ? { ...u, state } : u)));
    } catch (error) {
      setResults((current) =>
        current.map((u) => (u.userId === userId ? { ...u, state: 'none' } : u)),
      );
      reportError('No se pudo enviar la solicitud', error);
    } finally {
      setPending(null);
    }
  }, []);

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2">
        <View className="flex-row items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-4 py-3">
          <Ionicons name="search" size={18} color={colors.inkSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre de usuario"
            placeholderTextColor={colors.inkSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            className="flex-1 text-[15px] text-ink"
            style={{ paddingVertical: 0 }}
          />
          {loading ? <ActivityIndicator size="small" color={colors.inkSubtle} /> : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <UserRow user={item} onAdd={add} busy={pending === item.userId} />
        )}
        contentContainerClassName="px-5 pt-4 pb-8 gap-2.5"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length < MIN_QUERY ? (
            <Text className="mt-8 text-center text-[14px] text-ink-subtle">
              Escribe al menos {MIN_QUERY} letras del nombre de usuario.
            </Text>
          ) : searched && !loading ? (
            <EmptyState
              icon="person-outline"
              title="Nadie con ese nombre"
              message="Los nombres de usuario se crean solos al registrarse; pídele el suyo."
            />
          ) : null
        }
      />
    </Screen>
  );
}
