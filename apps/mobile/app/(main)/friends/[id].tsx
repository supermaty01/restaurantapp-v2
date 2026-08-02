import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

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
import { CollapsingHeader } from '@/features/social/components/CollapsingHeader';
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
 *
 * **Y una sección vacía era el síntoma de un fallo del servidor, no una
 * elección de nadie**: hasta la migración 0024, un plato comido dentro de una
 * visita compartida no contaba para la pestaña de platos, así que a quien
 * registra sus comidas como visitas —el camino normal— se le escondían las dos
 * pestañas del catálogo y el perfil entero se veía como una lista de visitas.
 * El razonamiento largo está en la propia migración.
 *
 * ## Se desliza, como el diario
 *
 * Las tres secciones son caras de lo mismo y se recorren seguidas, que es el
 * único caso en que `swipeable` compensa (ver `SegmentedTabs`). El coste —las
 * tres páginas montadas a la vez— aquí es una petición por sección al abrir el
 * perfil, no tres consultas vivas contra SQLite.
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

  /*
   * Cuánto ha bajado la sección que se está mirando.
   *
   * Uno solo para las tres, y lo escribe únicamente la activa: con el pager,
   * las tres listas existen a la vez y las tres pueden emitir desplazamiento
   * durante una transición. Cada sección recuerda además el suyo y lo repone al
   * volverse activa, o cambiar de pestaña dejaría la cabecera recogida sobre
   * una lista que está arriba del todo.
   */
  const scrollY = useSharedValue(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
  const current = activeSection ?? sections[0] ?? null;

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

  const expandedHeader = (
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

  /*
   * Lo que queda al recogerse: de quién es este perfil, y nada más.
   *
   * No se va del todo porque una lista de tarjetas ajenas sin ninguna cabecera
   * no dice de quién es lo que estás leyendo — y aquí, a diferencia del feed,
   * las tarjetas son todas de la misma persona, así que tampoco lo dice la
   * lista.
   */
  const collapsedHeader = (
    <View className="flex-row items-center gap-3 px-1 py-2.5">
      <Avatar name={name} uri={user.avatarUrl} size={34} />
      <View className="min-w-0 flex-1">
        <Txt variant="body" weight="bold" serif={false} numberOfLines={1}>
          {name}
        </Txt>
        <Txt variant="caption" tone="subtle" numberOfLines={1}>
          @{user.username}
        </Txt>
      </View>
    </View>
  );

  const renderSection = (kind: FeedKind) => (
    <Section userId={id} kind={kind} scrollY={scrollY} active={current === kind} />
  );

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2">
        <CollapsingHeader scrollY={scrollY} expanded={expandedHeader} collapsed={collapsedHeader} />
      </View>

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
        <View className="flex-1 pt-3">{renderSection(sections[0] as FeedKind)}</View>
      ) : (
        <SegmentedTabs
          tabs={sections.map((kind) => ({
            key: kind,
            label: `${SECTION_LABEL[kind]} ${counts.data?.[kind] ?? 0}`,
            render: () => renderSection(kind),
          }))}
          selectedKey={current ?? undefined}
          onSelect={setActiveSection}
          swipeable
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
function Section({
  userId,
  kind,
  scrollY,
  active,
}: {
  userId: string;
  kind: FeedKind;
  /** El desplazamiento compartido que encoge la cabecera. */
  scrollY: SharedValue<number>;
  /** Si esta es la pestaña que se está mirando. Solo la activa manda. */
  active: boolean;
}) {
  const { colors } = useTheme();
  const [options, setOptions] = useState<SectionOptions>(defaultSectionOptions);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const section = useUserSection(userId, kind, options);
  const activeFilters = activeSectionFilterCount(options);

  /*
   * Cada lista recuerda por dónde iba.
   *
   * Sin esto, cambiar de pestaña deja la cabecera como la dejó la anterior: te
   * llevas una lista empezada por arriba con el perfil recogido, o al revés.
   * El desplazamiento propio se guarda siempre; al compartido solo escribe la
   * activa, porque durante un arrastre entre páginas las tres están vivas.
   */
  const ownOffset = useSharedValue(0);
  const isActive = useSharedValue(active);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Negativo cuando se estira por arriba (el rebote de iOS), y eso pondría
      // la cabecera más alta que su altura medida.
      const y = Math.max(0, event.contentOffset.y);
      ownOffset.value = y;
      if (isActive.value) scrollY.value = y;
    },
  });

  // En un efecto y no en el render: escribir en un valor compartido mientras
  // React renderiza es el mismo efecto secundario fuera de sitio que en
  // `AuthContext`, y aquí además React puede llamar al render dos veces.
  useEffect(() => {
    isActive.value = active;
    if (active) scrollY.value = ownOffset.value;
  }, [active, isActive, scrollY, ownOffset]);

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

      <Animated.FlatList
        data={section.items}
        keyExtractor={(item) => `${item.kind}:${item.entityUuid}`}
        renderItem={({ item }) => <FeedCard entry={item} />}
        // Con `style` y no con `contentContainerClassName`: `Animated.FlatList`
        // lo envuelve reanimated, no NativeWind, así que la clase no llegaría a
        // ninguna parte y el fallo sería una lista sin márgenes.
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        // El manejador corre en el hilo de interfaz, así que no hay ningún salto
        // a JavaScript por fotograma que ahorrar bajando la frecuencia.
        scrollEventThrottle={16}
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
