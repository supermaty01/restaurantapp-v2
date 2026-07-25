import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { SectionList, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import { groupByMonth } from '../utils/groupByMonth';

import type { VisitListDTO } from '../types/visit-dto';

/** Screen gutter, matching the rest of the app. */
const GUTTER = 20;
/** Tight, like a photo library: the pictures should read as one surface. */
const GAP = 3;
const COLUMNS = 3;

/**
 * Visits as a photo timeline, grouped by month.
 *
 * A flat reverse-chronological list of a few hundred visits gives you no sense
 * of *when* — you scroll past three years without noticing. Pinned month
 * headers turn the same data into something you can navigate by memory, which
 * is how you actually look for a meal ("that place we went to last autumn").
 *
 * Tiles are square and near-flush, so the photos carry the screen. Visits with
 * no photo fall back to the warm placeholder rather than leaving holes.
 */
export function VisitTimeline({
  visits,
  onPressVisit,
}: {
  visits: VisitListDTO[];
  onPressVisit: (id: number) => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const tileSize = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const sections = useMemo(
    () => groupByMonth(visits, (visit) => visit.visited_at, COLUMNS),
    [visits],
  );

  if (visits.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="Ninguna visita todavía"
        message="Cuando registres dónde has comido, tus visitas se agruparán por mes aquí."
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row, index) => `${row[0]?.id ?? 'row'}-${index}`}
      stickySectionHeadersEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 112 }}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-baseline justify-between bg-canvas pb-2.5 pt-4">
          <Txt variant="title">{section.title}</Txt>
          <Txt variant="caption" tone="subtle">
            {section.count} {section.count === 1 ? 'visita' : 'visitas'}
          </Txt>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
          {row.map((visit) => (
            <VisitTile
              key={visit.id}
              visit={visit}
              size={tileSize}
              onPress={() => onPressVisit(visit.id)}
            />
          ))}
          {/* Keeps a short last row left-aligned instead of stretched. */}
          {row.length < COLUMNS
            ? Array.from({ length: COLUMNS - row.length }, (_, i) => (
                <View key={`filler-${i}`} style={{ width: tileSize }} />
              ))
            : null}
        </View>
      )}
      ListFooterComponent={
        <View className="items-center py-6">
          <Ionicons name="restaurant-outline" size={16} color={colors.inkSubtle} />
          <Txt variant="caption" tone="subtle" className="mt-1.5">
            {visits.length} {visits.length === 1 ? 'visita' : 'visitas'} en total
          </Txt>
        </View>
      }
    />
  );
}

function VisitTile({
  visit,
  size,
  onPress,
}: {
  visit: VisitListDTO;
  size: number;
  onPress: () => void;
}) {
  const name = visit.restaurant?.name ?? 'Sin restaurante';
  const uri = visit.images?.[0]?.uri ?? null;

  return (
    <PressableScale
      accessibilityLabel={name}
      onPress={onPress}
      scaleTo={0.95}
      style={{ width: size, height: size }}
    >
      <Thumbnail name={name} uri={uri} size={size} radius={4} icon="restaurant" />

      {/* The name only shows over a placeholder; over a photo it would fight
          with it, and the tile is tappable either way. */}
      {uri ? null : (
        <View className="absolute inset-x-0 bottom-0 p-1.5">
          <Txt
            variant="overline"
            serif={false}
            weight="bold"
            numberOfLines={2}
            style={{ color: '#FFFFFF', letterSpacing: 0 }}
          >
            {name}
          </Txt>
        </View>
      )}
    </PressableScale>
  );
}
