import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { ImageLightbox } from '@/components/media/ImageLightbox';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import {
  fetchUserProfile,
  fetchUserSectionCounts,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  type FeedEntry,
  type FriendshipState,
  type PublicProfile,
  type SectionKind,
} from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';
import {
  activeSectionFilterCount,
  defaultSectionFilters,
  SectionFilterSheet,
  type SectionFilters,
} from '@/features/social/components/SectionFilterSheet';
import { cancelRequestDialog, removeFriendDialog } from '@/features/social/confirmations';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useUserSection } from '@/features/social/hooks/useUserSection';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';

/** Las tres secciones, en el mismo orden que el diario propio. */
const SECTIONS: { kind: SectionKind; label: string }[] = [
  { kind: 'visit', label: 'Visitas' },
  { kind: 'restaurant', label: 'Lugares' },
  { kind: 'dish', label: 'Platos' },
];

/**
 * Someone else's profile.
 *
 * How much of it fills in is decided by the server, not here: a stranger sees
 * a name and whatever is public, a friend sees the friends-only entries and the
 * bio. The client never filters the response — doing that would mean the data
 * had already been sent.
 *
 * Se reparte en visitas / lugares / platos como el diario propio, porque son las
 * mismas tres cosas y quien viene aquí suele venir a una de ellas. **Solo salen
 * las secciones que tienen algo**: los conteos llegan antes que las listas
 * (`user_section_counts`, 0021), así que a alguien que no es tu amigo y solo
 * tiene sitios públicos se le enseña una pestaña y no tres con dos vacías. Con
 * una sola sección no se dibuja ninguna pestaña: un selector de una opción no es
 * un selector.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { ask } = useDialog();
  const [busy, setBusy] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<SectionFilters>(defaultSectionFilters);
  const [activeKind, setActiveKind] = useState<SectionKind | null>(null);

  const profile = useAsyncResource<PublicProfile | null>(() => fetchUserProfile(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  const counts = useAsyncResource(() => fetchUserSectionCounts(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  /** Las que tienen algo que enseñar, en el orden del diario. */
  const available = useMemo(
    () => SECTIONS.filter((section) => (counts.data?.[section.kind] ?? 0) > 0),
    [counts.data],
  );

  // La pestaña elegida a mano manda; si no, la primera que tenga algo. Se
  // calcula en vez de guardarse para que no quede apuntando a una sección que
  // los conteos dicen que está vacía.
  const kind = available.some((section) => section.kind === activeKind)
    ? (activeKind as SectionKind)
    : (available[0]?.kind ?? null);

  const query = useMemo(
    () =>
      kind ? { kind, sort: filters.sort, minRating: filters.minRating, page: 0 } : null,
    [kind, filters],
  );

  const entries = useUserSection(id, query);

  const act = useCallback(
    async (action: () => Promise<FriendshipState>, failure: string) => {
      setBusy(true);
      try {
        await action();
        await Promise.all([profile.reload(), counts.reload(), entries.reload()]);
      } catch (error) {
        reportError(failure, error);
      } finally {
        setBusy(false);
      }
    },
    [profile, counts, entries],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedEntry }) => <FeedCard entry={item} />,
    [],
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

  /**
   * Quitar no se deshace solo: volver a ser amigos exige una solicitud nueva y
   * que la acepte la otra persona. Cancelar una solicitud enviada es otra cosa
   * —nadie se entera— y por eso pregunta distinto.
   */
  const confirmRemove = async () => {
    const sent = user.state === 'request_sent';
    const confirmed = await ask(sent ? cancelRequestDialog(name) : removeFriendDialog(name));
    if (confirmed) await act(() => removeFriend(user.userId), 'No se pudo quitar');
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={entries.items}
        keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
        renderItem={renderItem}
        contentContainerClassName="px-5 pb-8 gap-3"
        showsVerticalScrollIndicator={false}
        onEndReached={entries.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          entries.loadingMore ? (
            <View className="py-5">
              <ActivityIndicator />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={entries.loading}
            onRefresh={() => {
              void counts.reload();
              void entries.reload();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="pb-2">
            <Card className="items-center gap-3 py-5">
              {/* La foto se abre a pantalla completa. Es el único sitio donde
                  se ve la cara de alguien en grande, y una foto de perfil de 72
                  puntos es justo la que apetece mirar entera. Solo si la hay:
                  ampliar unas iniciales no enseña nada. */}
              <Pressable
                accessibilityRole={user.avatarUrl ? 'imagebutton' : 'image'}
                accessibilityLabel={user.avatarUrl ? `Ver la foto de ${name}` : name}
                disabled={!user.avatarUrl}
                onPress={() => setViewingPhoto(true)}
              >
                <Avatar name={name} uri={user.avatarUrl} size={88} />
              </Pressable>

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
                onRemove={() => void confirmRemove()}
              />
            </Card>

            {kind ? (
              <SectionBar
                sections={available}
                active={kind}
                counts={counts.data ?? { visit: 0, dish: 0, restaurant: 0 }}
                filterCount={activeSectionFilterCount(filters)}
                onSelect={setActiveKind}
                onOpenFilters={() => setFiltersOpen(true)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          entries.loading || counts.loading ? null : (
            <EmptyState
              icon="albums-outline"
              title={
                activeSectionFilterCount(filters) > 0
                  ? 'Nada con ese filtro'
                  : user.state === 'friends'
                    ? 'Todavía no ha compartido nada'
                    : 'Nada público por aquí'
              }
              message={
                activeSectionFilterCount(filters) > 0
                  ? 'Prueba a bajar la valoración mínima.'
                  : user.state === 'friends'
                    ? 'Cuando comparta una visita o un plato, aparecerá aquí.'
                    : 'Si os hacéis amigos podrás ver lo que comparta con sus amigos.'
              }
            />
          )
        }
      />

      {kind ? (
        <SectionFilterSheet
          visible={filtersOpen}
          kind={kind}
          filters={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={setFilters}
        />
      ) : null}

      {user.avatarUrl ? (
        <ImageLightbox
          images={[{ id: user.userId, uri: user.avatarUrl }]}
          initialIndex={0}
          visible={viewingPhoto}
          onClose={() => setViewingPhoto(false)}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Las secciones y el botón de filtros, en una fila.
 *
 * Con una sola sección disponible no se dibuja el selector: un control de una
 * opción es un adorno que ocupa la altura de un control.
 */
function SectionBar({
  sections,
  active,
  counts,
  filterCount,
  onSelect,
  onOpenFilters,
}: {
  sections: { kind: SectionKind; label: string }[];
  active: SectionKind;
  counts: Record<SectionKind, number>;
  filterCount: number;
  onSelect: (kind: SectionKind) => void;
  onOpenFilters: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View className="mt-4 flex-row items-center gap-2">
      {sections.length > 1 ? (
        <View className="flex-1 flex-row gap-2">
          {sections.map((section) => {
            const selected = section.kind === active;
            return (
              <PressableScale
                key={section.kind}
                accessibilityState={{ selected }}
                accessibilityLabel={`${section.label}, ${counts[section.kind]}`}
                onPress={() => onSelect(section.kind)}
                scaleTo={0.95}
                className={`rounded-pill px-3.5 py-2 ${
                  selected ? 'bg-primary' : 'border border-line-strong bg-surface'
                }`}
              >
                <Txt
                  variant="caption"
                  weight={selected ? 'bold' : 'semi'}
                  serif={false}
                  tone={selected ? 'onPrimary' : 'muted'}
                >
                  {section.label} · {counts[section.kind]}
                </Txt>
              </PressableScale>
            );
          })}
        </View>
      ) : (
        <Txt variant="caption" tone="subtle" className="flex-1">
          {sections[0]?.label} · {counts[active]}
        </Txt>
      )}

      <PressableScale
        accessibilityLabel="Filtrar y ordenar"
        onPress={onOpenFilters}
        scaleTo={0.92}
        className="h-9 flex-row items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3"
      >
        <Ionicons name="options-outline" size={16} color={colors.ink} />
        {filterCount > 0 ? (
          <Txt variant="caption" weight="bold" serif={false} tone="primary">
            {filterCount}
          </Txt>
        ) : null}
      </PressableScale>
    </View>
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
