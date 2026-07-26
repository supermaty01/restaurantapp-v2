import { useMemo } from 'react';
import { SectionList, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { EmptyState } from '@/components/ui/Surface';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Txt } from '@/components/ui/Txt';
import { formatDate } from '@/lib/helpers/date';

import { groupByMonth } from '../utils/groupByMonth';

import type { VisitListDTO } from '../types/visit-dto';

/** Screen gutter, matching the rest of the app. */
const GUTTER = 20;
const GAP = 10;
/** Two columns, not three: a photo plus a name and a date needs the width. */
const COLUMNS = 2;

/**
 * Visits as a photo timeline, grouped by month.
 *
 * A flat reverse-chronological list of a few hundred visits gives you no sense
 * of *when* — you scroll past three years without noticing. Pinned month
 * headers turn the same data into something you can navigate by memory, which
 * is how you actually look for a meal ("that place we went to last autumn").
 *
 * Each tile keeps its restaurant and date: a wall of bare photographs is
 * pretty and unsearchable, and half of what you are scanning for is the name.
 */
export function VisitTimeline({
  visits,
  onPressVisit,
  order = 'desc',
}: {
  visits: VisitListDTO[];
  onPressVisit: (id: number) => void;
  /** Follows the list's sort order, so the filter sheet actually does something. */
  order?: 'asc' | 'desc';
}) {
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const sections = useMemo(
    () => groupByMonth(visits, (visit) => visit.visited_at, COLUMNS, new Date(), order),
    [visits, order],
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
      // La clave es la fila, no su posición: `${id}-${index}` cambiaba cada vez
      // que una fila se movía, y en las filas vacías degeneraba a "row-0", que
      // se repite en todos los meses. Las claves duplicadas hacen que React
      // reutilice celdas equivocadas.
      keyExtractor={(row) => row.map((visit) => visit.id).join('-')}
      stickySectionHeadersEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 112 }}
      initialNumToRender={9}
      maxToRenderPerBatch={9}
      windowSize={11}
      // En Android esto viene activado por defecto en VirtualizedList, y es la
      // causa clásica de que el contenido se vacíe a mitad de scroll dejando
      // solo la cabecera pegada: las celdas se desmontan al salir del área
      // recortada y la de reemplazo aún no se ha montado. Con retículas de
      // fotos, que ya son caras de montar, se nota como un parpadeo en un punto
      // fijo del recorrido.
      removeClippedSubviews={false}
      renderSectionHeader={({ section }) => (
        // Full-bleed and opaque: the padding used to live on the content
        // container, which inset the pinned header and let photos scroll
        // visibly through the gutters on either side of it.
        <View className="border-b border-line bg-canvas px-5 pb-2.5 pt-4">
          <View className="flex-row items-baseline justify-between">
            <Txt variant="title">{section.title}</Txt>
            <Txt variant="caption" tone="subtle">
              {section.count} {section.count === 1 ? 'visita' : 'visitas'}
            </Txt>
          </View>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View
          style={{
            flexDirection: 'row',
            gap: GAP,
            paddingHorizontal: GUTTER,
            paddingTop: GAP,
          }}
        >
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
        <View className="items-center py-8">
          <Txt variant="caption" tone="subtle">
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
      accessibilityLabel={`${name}, ${formatDate(visit.visited_at)}`}
      onPress={onPress}
      scaleTo={0.96}
      style={{ width: size }}
    >
      <Thumbnail name={name} uri={uri} size={size} radius={12} icon="restaurant" />
      <View className="pt-1.5">
        <Txt variant="callout" weight="bold" serif={false} numberOfLines={1}>
          {name}
        </Txt>
        <Txt variant="caption" tone="subtle" numberOfLines={1}>
          {formatDate(visit.visited_at)}
          {visit.comments ? ` · ${visit.comments}` : ''}
        </Txt>
      </View>
    </PressableScale>
  );
}
