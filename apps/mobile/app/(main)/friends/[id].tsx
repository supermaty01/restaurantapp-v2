import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ImageLightbox } from '@/components/media/ImageLightbox';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Card, Chip, EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import {
  fetchUserEntryCounts,
  fetchUserProfile,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/features/social/api';
import type {
  FeedKind,
  FriendshipState,
  PublicProfile,
  UserEntryCounts,
} from '@/features/social/api';
import { FeedCard } from '@/features/social/components/FeedCard';
import {
  activeSectionFilterCount,
  SectionFilterSheet,
} from '@/features/social/components/SectionFilterSheet';
import { cancelRequestDialog, removeFriendDialog } from '@/features/social/confirmations';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import {
  defaultSectionOptions,
  useUserSection,
  type SectionOptions,
} from '@/features/social/hooks/useUserSection';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';

/**
 * Someone else's profile.
 *
 * How much of it fills in is decided by the server, not here: a stranger sees
 * a name and whatever is public, a friend sees the friends-only entries and the
 * bio. The client never filters the response — doing that would mean the data
 * had already been sent.
 *
 * ## Por qué se reparte en secciones, y por qué no siempre son tres
 *
 * Antes era una sola lista con las tres clases mezcladas por fecha, que es la
 * forma del feed. Un perfil no se lee así: se entra a ver *sus sitios*, o *sus
 * platos*, igual que el diario propio se reparte en tres. Así que aquí también,
 * y con los mismos filtros de orden y nota.
 *
 * Pero **solo salen las secciones que tienen algo**. A quien no es tu amigo y
 * solo ha hecho públicos un par de sitios se le enseña una pestaña, no tres con
 * dos vacías: una pestaña vacía se lee como «no ha compartido nada» cuando lo
 * que significa es «esto no te toca». Los recuentos los da el servidor (0022),
 * que es el único que sabe cuánto de esto puede ver quien mira.
 */
const SECTION_LABEL: Record<FeedKind, string> = {
  visit: 'Visitas',
  restaurant: 'Lugares',
  dish: 'Platos',
};

/** El mismo orden que el diario propio: las visitas mandan, el catálogo detrás. */
const SECTION_ORDER: FeedKind[] = ['visit', 'restaurant', 'dish'];

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { ask } = useDialog();
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const profile = useAsyncResource<PublicProfile | null>(() => fetchUserProfile(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  const counts = useAsyncResource<UserEntryCounts>(() => fetchUserEntryCounts(id), {
    enabled: Boolean(id),
    deps: [id],
  });

  const sections = useMemo(
    () => SECTION_ORDER.filter((kind) => (counts.data?.[kind] ?? 0) > 0),
    [counts.data],
  );

  const act = useCallback(
    async (action: () => Promise<FriendshipState>, failure: string) => {
      setBusy(true);
      try {
        await action();
        // Los recuentos también: hacerse amigo destapa lo que estaba en «solo
        // amigos», así que las pestañas que se ven son otras.
        await Promise.all([profile.reload(), counts.reload()]);
      } catch (error) {
        reportError(failure, error);
      } finally {
        setBusy(false);
      }
    },
    [profile, counts],
  );

  if ((profile.loading && !profile.data) || (counts.loading && !counts.data)) {
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

  /*
   * Quitar a alguien pregunta antes, y pregunta distinto según qué se deshace.
   *
   * `onRemove` sirve para dos cosas: retirar una solicitud que aún no ha
   * contestado nadie, y deshacer una amistad — que la otra persona nota, sin
   * haber hecho nada. Un solo aviso rojo para las dos es el aviso que se
   * descarta sin leer, y entonces el que importaba tampoco se lee.
   */
  const confirmRemove = async () => {
    const request = user.state === 'request_sent' ? cancelRequestDialog : removeFriendDialog;
    if (await ask(request(name))) {
      await act(() => removeFriend(user.userId), 'No se pudo quitar');
    }
  };

  const header = (
    <Card className="items-center gap-3 py-5">
      {/* La foto se abre a pantalla completa. Solo desde aquí: en una lista de
          tarjetas, un avatar es el atajo al perfil de quien publicó, y que a
          veces abriera la foto haría el atajo impredecible. */}
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={user.avatarUrl ? `Ver la foto de ${name}` : name}
        disabled={!user.avatarUrl}
        onPress={() => setPhotoOpen(true)}
      >
        <Avatar name={name} uri={user.avatarUrl} size={72} />
      </Pressable>

      <View className="items-center">
        <Txt variant="title">{name}</Txt>
        <Txt variant="caption" tone="subtle">
          @{user.username}
        </Txt>
      </View>

      {user.bio ? (
        <Txt variant="callout" tone="muted" className="px-4 text-center">
          {user.bio}
        </Txt>
      ) : null}

      <View className="flex-row gap-6">
        <Counter value={user.sharedCount} label="visitas" />
        <Counter value={user.friendCount} label="amigos" />
      </View>

      <RelationshipAction
        state={user.state}
        busy={busy}
        onAdd={() => act(() => sendFriendRequest(user.userId), 'No se pudo enviar')}
        onAccept={() => act(() => respondFriendRequest(user.userId, true), 'No se pudo aceptar')}
        onDecline={() => act(() => respondFriendRequest(user.userId, false), 'No se pudo rechazar')}
        onRemove={() => void confirmRemove()}
      />
    </Card>
  );

  return (
    <Screen padded={false}>
      <View className="px-5 pb-1 pt-2">{header}</View>

      {sections.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title={
            user.state === 'friends' ? 'Todavía no ha compartido nada' : 'Nada público por aquí'
          }
          message={
            user.state === 'friends'
              ? 'Cuando comparta una visita, un plato o un sitio, aparecerá aquí.'
              : 'Si os hacéis amigos podrás ver lo que comparta con sus amigos.'
          }
        />
      ) : sections.length === 1 ? (
        // Una sola sección no necesita un control para elegir entre una cosa.
        <Section userId={id} kind={sections[0] as FeedKind} />
      ) : (
        <SegmentedTabs
          tabs={sections.map((kind) => ({
            key: kind,
            label: `${SECTION_LABEL[kind]} ${counts.data?.[kind] ?? 0}`,
            render: () => <Section userId={id} kind={kind} />,
          }))}
        />
      )}

      {user.avatarUrl ? (
        <ImageLightbox
          images={[{ id: user.userId, uri: user.avatarUrl }]}
          initialIndex={0}
          visible={photoOpen}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </Screen>
  );
}

/** Una sección: la lista de una clase, con su orden y su filtro propios. */
function Section({ userId, kind }: { userId: string; kind: FeedKind }) {
  const { colors } = useTheme();
  const [options, setOptions] = useState<SectionOptions>(defaultSectionOptions);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const section = useUserSection(userId, kind, options);
  const activeFilters = activeSectionFilterCount(options);

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-end px-5 pb-2">
        <PressableScale
          accessibilityLabel="Filtrar y ordenar"
          onPress={() => setFiltersOpen(true)}
          scaleTo={0.94}
          className="flex-row items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5"
        >
          <Ionicons name="options-outline" size={15} color={colors.inkMuted} />
          <Txt variant="caption" weight="semi" serif={false} tone="muted">
            Ordenar
          </Txt>
          {activeFilters > 0 ? <Chip label={String(activeFilters)} tone="primary" /> : null}
        </PressableScale>
      </View>

      <FlatList
        data={section.items}
        keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
        renderItem={({ item }) => <FeedCard entry={item} />}
        contentContainerClassName="px-5 pb-8 gap-3"
        showsVerticalScrollIndicator={false}
        onEndReached={section.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          section.loadingMore ? (
            <View className="py-5">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={section.loading}
            onRefresh={section.reload}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          section.loading ? null : (
            // La sección existe porque el recuento dijo que tenía algo, así que
            // vacía solo puede significar que el filtro se lo comió todo.
            <EmptyState
              icon="funnel-outline"
              title="Nada con ese filtro"
              message="Baja la valoración mínima para ver el resto."
            />
          )
        }
      />

      <SectionFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        kind={kind}
        options={options}
        onApply={setOptions}
      />
    </View>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center">
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" tone="subtle">
        {label}
      </Txt>
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
