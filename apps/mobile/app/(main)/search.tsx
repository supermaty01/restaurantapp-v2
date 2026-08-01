import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, Chip, EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useDishList } from '@/features/dishes/hooks/useDishList';
import { useRestaurantList } from '@/features/restaurants/hooks/useRestaurantList';
import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { ASSISTANT_ENABLED } from '@/lib/features';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Hit {
  key: string;
  kind: 'restaurant' | 'dish';
  id: number;
  title: string;
  subtitle: string | null;
  imageUri: string | null;
  imageRemoteKey: string | null;
}

/**
 * Search across the whole diary.
 *
 * Each list had its own search box, which meant knowing in advance whether what
 * you half-remember was filed as a place or a dish. This searches both.
 *
 * It is also where the assistant will live (docs/07). Natural-language search is
 * the same job — "¿cuántas hamburguesas comí este año?" is a query, not a
 * separate feature — so it belongs behind this field rather than in a tab of its
 * own. The prompt below is a placeholder until the agent is wired up.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const restaurants = useRestaurantList();
  const dishes = useDishList();

  const term = query.trim().toLowerCase();

  const hits = useMemo<Hit[]>(() => {
    if (term.length < 2) return [];

    const matches = (text: string | null | undefined) =>
      Boolean(text && text.toLowerCase().includes(term));

    const places: Hit[] = restaurants
      .filter((r) => matches(r.name) || matches(r.comments))
      .map((r) => ({
        key: `restaurant-${r.id}`,
        kind: 'restaurant' as const,
        id: r.id,
        title: r.name,
        subtitle: r.comments,
        imageUri: r.images?.[0]?.uri ?? null,
        imageRemoteKey: r.images?.[0]?.remoteKey ?? null,
      }));

    const plates: Hit[] = dishes
      .filter((d) => matches(d.name) || matches(d.comments))
      .map((d) => ({
        key: `dish-${d.id}`,
        kind: 'dish' as const,
        id: d.id,
        title: d.name,
        subtitle: d.comments,
        imageUri: d.images?.[0]?.uri ?? null,
        imageRemoteKey: d.images?.[0]?.remoteKey ?? null,
      }));

    // Places first: a half-remembered name is usually a place.
    return [...places, ...plates];
  }, [term, restaurants, dishes]);

  const open = (hit: Hit) =>
    router.push(
      hit.kind === 'restaurant'
        ? `/(main)/restaurants/${hit.id}/view`
        : `/(main)/dishes/${hit.id}/view`,
    );

  return (
    <Screen padded={false}>
      <View className="px-5 pt-1">
        <View
          className="flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-3"
          style={elevation.low}
        >
          <Ionicons name="search" size={18} color={colors.inkSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Un lugar, un plato…"
            placeholderTextColor={colors.inkSubtle}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 text-ink"
            style={{ fontSize: 15, paddingVertical: 2 }}
          />
        </View>
      </View>

      <FlatList
        data={hits}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <Card onPress={() => open(item)} className="flex-row items-center gap-3">
            <Thumbnail
              name={item.title}
              uri={item.imageUri}
              remoteKey={item.imageRemoteKey}
              size={52}
              icon={item.kind === 'dish' ? 'fast-food' : 'restaurant'}
            />
            <View className="min-w-0 flex-1">
              <Txt variant="heading" weight="bold" serif={false} numberOfLines={1}>
                {item.title}
              </Txt>
              {item.subtitle ? (
                <Txt variant="caption" tone="subtle" numberOfLines={1}>
                  {item.subtitle}
                </Txt>
              ) : null}
            </View>
            <Chip label={item.kind === 'dish' ? 'Plato' : 'Lugar'} tone="neutral" />
          </Card>
        )}
        contentContainerClassName="px-5 pt-4 pb-8 gap-2.5"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={term.length < 2 ? <SearchIntro /> : <NoResults term={query.trim()} />}
      />
    </Screen>
  );
}

/**
 * Placeholder for the assistant (docs/07).
 *
 * It states what will be possible rather than pretending to work: the examples
 * are the real target queries, and tapping does nothing yet on purpose. A
 * disabled affordance that explains itself is more honest than hiding the plan.
 */
/**
 * What the empty search screen says.
 *
 * With the assistant off, promising it here would be advertising something the
 * build does not contain. The same space says what search *can* do instead.
 */
function SearchIntro() {
  if (!ASSISTANT_ENABLED) return <SearchHint />;
  return <AssistantTeaser />;
}

function SearchHint() {
  const { colors } = useTheme();
  return (
    <View className="mt-4 items-center gap-2 px-6">
      <Ionicons name="search-outline" size={26} color={colors.inkSubtle} />
      <Txt variant="callout" tone="muted" className="text-center">
        Busca por nombre entre tus restaurantes, platos y visitas.
      </Txt>
    </View>
  );
}

function AssistantTeaser() {
  const { colors } = useTheme();

  const examples = [
    '¿Cuántas hamburguesas comí este año?',
    '¿Cuándo fue la última vez que comí con Irene?',
    '¿Qué carbonaras probé en Roma?',
  ];

  return (
    <View className="mt-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
        <Txt variant="overline" tone="primary" weight="bold" serif={false} uppercase>
          Próximamente
        </Txt>
      </View>
      <Txt variant="title" className="mt-2">
        Pregúntale a tu diario
      </Txt>
      <Txt variant="callout" tone="muted" className="mt-1.5">
        El asistente podrá responder con tus propios datos, sin salir de la app.
      </Txt>

      <View className="mt-4 gap-2">
        {examples.map((example) => (
          <View
            key={example}
            className="flex-row items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3.5 py-3"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.inkSubtle} />
            {/* Sin recortar: el ejemplo *es* el mensaje. "¿Cuándo fue la
                última vez que comí con Ir…" no promete nada. */}
            <Txt variant="callout" tone="subtle" className="flex-1">
              {example}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function NoResults({ term }: { term: string }) {
  const router = useRouter();

  return (
    <EmptyState
      icon="search-outline"
      title="Nada con ese nombre"
      message={`No hay lugares ni platos que contengan «${term}».`}
      action={
        <QuickCreate
          label="Crear un lugar"
          icon="location-outline"
          path="/(main)/restaurants/new"
        />
      }
    />
  );

  function QuickCreate({ label, icon, path }: { label: string; icon: IconName; path: string }) {
    const { colors } = useTheme();
    return (
      <PressableScale
        accessibilityLabel={label}
        onPress={() => router.push(path)}
        className="flex-row items-center gap-2 rounded-pill bg-primary px-4 py-2.5"
      >
        <Ionicons name={icon} size={16} color={colors.onPrimary} />
        <Txt variant="callout" weight="bold" serif={false} tone="onPrimary">
          {label}
        </Txt>
      </PressableScale>
    );
  }
}
