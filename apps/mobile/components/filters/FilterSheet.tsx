import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useSharingAvailable } from '@/features/privacy/useSharingAvailable';
import { VISIBILITIES, VISIBILITY_META, type Visibility } from '@/features/privacy/visibility';
import Tag from '@/features/tags/components/Tag';
import { useTagsList } from '@/features/tags/hooks/useTagsList';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';

export type SortField = 'name' | 'rating' | 'date' | 'restaurant' | 'created';
export type SortOrder = 'asc' | 'desc';

export interface FilterSortOptions {
  selectedTags: TagDTO[];
  minRating: number | null;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedRestaurantId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  /**
   * Only entries stored with these visibilities. Empty means all of them.
   *
   * The stored value, not the resolved one: "cuáles dejé en automático" is a
   * different question from "cuáles se ven", and the one you need when auditing
   * what you are sharing is the first — those are the ones a change to the
   * general setting will move.
   */
  visibilities: Visibility[];
}

export const defaultFilterSortOptions: FilterSortOptions = {
  selectedTags: [],
  minRating: null,
  sortField: 'name',
  sortOrder: 'asc',
  selectedRestaurantId: null,
  dateFrom: null,
  dateTo: null,
  visibilities: [],
};

export type EntityType = 'restaurant' | 'dish' | 'visit';

const SORT_LABELS: Record<SortField, string> = {
  name: 'Nombre',
  rating: 'Valoración',
  date: 'Fecha',
  restaurant: 'Restaurante',
  created: 'Añadido',
};

const SORT_FIELDS: Record<EntityType, SortField[]> = {
  restaurant: ['name', 'rating', 'created'],
  dish: ['name', 'rating', 'restaurant', 'created'],
  visit: ['date', 'restaurant', 'created'],
};

/** How many filters are engaged — what the header badge counts. */
export function activeFilterCount(options: FilterSortOptions): number {
  return (
    options.selectedTags.length +
    (options.minRating !== null ? 1 : 0) +
    (options.selectedRestaurantId !== null ? 1 : 0) +
    (options.visibilities.length > 0 ? 1 : 0)
  );
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  options: FilterSortOptions;
  onApply: (options: FilterSortOptions) => void;
  entityType: EntityType;
  restaurants?: { id: number; name: string }[];
  /**
   * How many rows the draft would leave. Shown live on the apply button, which
   * is the whole point of the redesign: the old panel let you build a filter
   * and only told you it matched nothing after you closed it.
   */
  countFor?: ((options: FilterSortOptions) => number) | undefined;
}

/**
 * Filtering and sorting.
 *
 * The previous version was a flat scroll of sections with unlabelled chips: no
 * hierarchy, no sign of what was already engaged, sorting buried under the
 * filters, and no feedback until you applied. This keeps the same options and
 * changes how they are presented — a summary of what is on, sort as a first
 * class row, and a live result count on the apply button.
 *
 * Edits are made to a draft, so closing without applying leaves the list alone.
 */
export function FilterSheet({
  visible,
  onClose,
  options,
  onApply,
  entityType,
  restaurants = [],
  countFor,
}: FilterSheetProps) {
  const sharing = useSharingAvailable();
  const { colors } = useTheme();
  const tags = useTagsList();
  const [draft, setDraft] = useState<FilterSortOptions>(options);

  // Re-seed whenever the sheet opens, so a cancelled edit is really cancelled.
  useEffect(() => {
    if (visible) setDraft(options);
  }, [visible, options]);

  const activeCount = activeFilterCount(draft);
  const resultCount = useMemo(() => countFor?.(draft), [countFor, draft]);

  const toggleTag = (tag: TagDTO) =>
    setDraft((d) => ({
      ...d,
      selectedTags: d.selectedTags.some((t) => t.id === tag.id)
        ? d.selectedTags.filter((t) => t.id !== tag.id)
        : [...d.selectedTags, tag],
    }));

  const sortFields = SORT_FIELDS[entityType];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrar y ordenar"
      subtitle={
        activeCount === 0
          ? 'Sin filtros activos'
          : `${activeCount} ${activeCount === 1 ? 'filtro activo' : 'filtros activos'}`
      }
      footer={
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label="Limpiar"
              variant="secondary"
              block
              disabled={activeCount === 0}
              onPress={() =>
                setDraft({
                  ...defaultFilterSortOptions,
                  sortField: draft.sortField,
                  sortOrder: draft.sortOrder,
                })
              }
            />
          </View>
          <View className="flex-[1.4]">
            <Button
              label={
                resultCount === undefined
                  ? 'Aplicar'
                  : resultCount === 0
                    ? 'Sin resultados'
                    : `Ver ${resultCount}`
              }
              block
              disabled={resultCount === 0}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            />
          </View>
        </View>
      }
    >
      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        {/* Which entries are shared, as a filter rather than a report. The
            question people actually have is "¿qué estoy compartiendo?", and
            answering it by opening entries one by one is not answering it.
            Sin cuenta no aparece: filtrar por algo que no se puede elegir es
            ofrecer una respuesta a una pregunta que nadie tiene. */}
        {sharing ? (
          <Section title="Quién lo ve">
            <View className="flex-row flex-wrap gap-2">
              {VISIBILITIES.map((option) => {
                const active = draft.visibilities.includes(option);
                return (
                  <PressableScale
                    key={option}
                    accessibilityLabel={VISIBILITY_META[option].label}
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        visibilities: active
                          ? current.visibilities.filter((v) => v !== option)
                          : [...current.visibilities, option],
                      }))
                    }
                    scaleTo={0.95}
                    className={`flex-row items-center gap-1.5 rounded-pill border px-3 py-2 ${
                      active ? 'border-primary bg-primary/10' : 'border-line-strong bg-surface'
                    }`}
                  >
                    <Ionicons
                      name={VISIBILITY_META[option].icon}
                      size={13}
                      color={active ? colors.primary : colors.inkSubtle}
                    />
                    <Txt
                      variant="caption"
                      weight="semi"
                      serif={false}
                      tone={active ? 'primary' : 'muted'}
                    >
                      {VISIBILITY_META[option].label}
                    </Txt>
                  </PressableScale>
                );
              })}
            </View>
          </Section>
        ) : null}

        <Section title="Ordenar por">
          <View className="flex-row flex-wrap gap-2">
            {sortFields.map((field) => (
              <Selectable
                key={field}
                label={SORT_LABELS[field]}
                selected={draft.sortField === field}
                onPress={() => setDraft((d) => ({ ...d, sortField: field }))}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setDraft((d) => ({ ...d, sortOrder: d.sortOrder === 'asc' ? 'desc' : 'asc' }))
            }
            className="mt-2.5 flex-row items-center gap-2 self-start rounded-pill bg-sunken px-3 py-2"
          >
            <Ionicons
              name={draft.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={colors.inkMuted}
            />
            <Txt variant="caption" tone="muted" weight="semi" serif={false}>
              {orderLabel(draft.sortField, draft.sortOrder)}
            </Txt>
          </Pressable>
        </Section>

        {/*
          Visits carry no tags, so offering the section there would be another
          filter that silently does nothing — same trap as the restaurant filter
          on dishes.
        */}
        {entityType !== 'visit' && tags.length > 0 ? (
          <Section
            title="Etiquetas"
            hint={draft.selectedTags.length > 0 ? `${draft.selectedTags.length} elegidas` : 'Todas'}
          >
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = draft.selectedTags.some((t) => t.id === tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={tag.name}
                    onPress={() => toggleTag(tag)}
                    className={`flex-row items-center gap-1.5 rounded-pill border p-0.5 pr-2 ${
                      selected ? 'border-primary bg-primary/8' : 'border-transparent'
                    }`}
                  >
                    <Tag name={tag.name} color={tag.color} />
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={selected ? colors.primary : colors.lineStrong}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Section>
        ) : null}

        {/*
          Only visits carry a restaurant on their list rows. The old panel
          offered this section for dishes too, where nothing consumed it: a
          filter that silently did nothing.
        */}
        {entityType === 'visit' && restaurants.length > 0 ? (
          <Section title="Restaurante">
            <View className="flex-row flex-wrap gap-2">
              <Selectable
                label="Cualquiera"
                selected={draft.selectedRestaurantId === null}
                onPress={() => setDraft((d) => ({ ...d, selectedRestaurantId: null }))}
              />
              {restaurants.map((restaurant) => (
                <Selectable
                  key={restaurant.id}
                  label={restaurant.name}
                  selected={draft.selectedRestaurantId === restaurant.id}
                  onPress={() => setDraft((d) => ({ ...d, selectedRestaurantId: restaurant.id }))}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {entityType !== 'visit' ? (
          <Section
            title="Valoración mínima"
            hint={draft.minRating ? `${draft.minRating} o más` : 'Cualquiera'}
          >
            <View className="flex-row items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const on = (draft.minRating ?? 0) >= star;
                return (
                  <PressableScale
                    key={star}
                    accessibilityLabel={`${star} estrellas o más`}
                    scaleTo={0.85}
                    // Tapping the current value clears it: otherwise there is no
                    // way back to "any rating" without the Limpiar button.
                    onPress={() =>
                      setDraft((d) => ({ ...d, minRating: d.minRating === star ? null : star }))
                    }
                    className="p-1"
                  >
                    <Ionicons
                      name="star"
                      size={26}
                      color={on ? colors.accent : colors.lineStrong}
                    />
                  </PressableScale>
                );
              })}
              {draft.minRating ? (
                <Pressable
                  onPress={() => setDraft((d) => ({ ...d, minRating: null }))}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar el mínimo de valoración"
                  hitSlop={8}
                  className="ml-1"
                >
                  <Txt variant="caption" tone="primary" weight="bold" serif={false}>
                    Quitar
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </Section>
        ) : null}

        <View className="h-4" />
      </ScrollView>
    </Sheet>
  );
}

/** "A → Z", "Más nuevas primero" — the direction, said in the field's terms. */
function orderLabel(field: SortField, order: SortOrder): string {
  if (field === 'name' || field === 'restaurant') return order === 'asc' ? 'A → Z' : 'Z → A';
  if (field === 'rating') return order === 'asc' ? 'Peor primero' : 'Mejor primero';
  return order === 'asc' ? 'Más antiguas primero' : 'Más recientes primero';
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="border-t border-line py-4 first:border-t-0">
      <View className="mb-3 flex-row items-baseline justify-between">
        <Txt variant="overline" tone="subtle" serif={false} uppercase>
          {title}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="subtle">
            {hint}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Selectable({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Chip
        label={label}
        tone={selected ? 'primary' : 'neutral'}
        {...(selected ? { icon: 'checkmark' as const } : {})}
      />
    </Pressable>
  );
}
