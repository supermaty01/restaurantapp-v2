import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import type { SectionKind, SectionSort } from '../api';

/**
 * Filtrar y ordenar el perfil de otra persona.
 *
 * Es el hermano de `components/filters/FilterSheet`, no una copia: la mitad de
 * aquellos filtros no existe aquí y ofrecerlos sería ofrecer botones que no
 * hacen nada. Las **etiquetas no se comparten** —son la libreta privada de quien
 * escribe, y no viajan a quien mira— y el filtro por restaurante necesita el
 * catálogo local, que del diario ajeno no se tiene.
 *
 * Lo que queda —orden y nota mínima— lo resuelve el servidor (0021), que es lo
 * único correcto cuando la lista llega por páginas: ordenar en el móvil solo
 * ordenaría lo que ya se ha bajado.
 */
export interface SectionFilters {
  sort: SectionSort;
  minRating: number | null;
}

export const defaultSectionFilters: SectionFilters = { sort: 'recent', minRating: null };

export function activeSectionFilterCount(filters: SectionFilters): number {
  return filters.minRating !== null ? 1 : 0;
}

const SORT_LABELS: Record<SectionSort, string> = {
  recent: 'Más recientes',
  oldest: 'Más antiguas',
  name: 'Nombre (A → Z)',
  rating: 'Mejor valoradas',
};

/** Una visita no lleva nota propia, así que ordenar por nota no diría nada. */
const SORTS_FOR: Record<SectionKind, SectionSort[]> = {
  visit: ['recent', 'oldest', 'name'],
  dish: ['recent', 'oldest', 'name', 'rating'],
  restaurant: ['recent', 'oldest', 'name', 'rating'],
};

export function SectionFilterSheet({
  visible,
  kind,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  kind: SectionKind;
  filters: SectionFilters;
  onClose: () => void;
  onApply: (next: SectionFilters) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(filters);

  // Se resiembra al abrir, para que cerrar sin aplicar deje la lista en paz.
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const sorts = SORTS_FOR[kind];
  const ratingApplies = kind !== 'visit';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrar y ordenar"
      subtitle={
        activeSectionFilterCount(draft) === 0 ? 'Sin filtros activos' : '1 filtro activo'
      }
      footer={
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label="Limpiar"
              variant="secondary"
              block
              disabled={draft.sort === 'recent' && draft.minRating === null}
              onPress={() => setDraft(defaultSectionFilters)}
            />
          </View>
          <View className="flex-[1.4]">
            <Button
              label="Aplicar"
              block
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
        <View className="border-t-0 py-4">
          <Txt variant="overline" tone="subtle" serif={false} uppercase className="mb-3">
            Ordenar por
          </Txt>
          <View className="flex-row flex-wrap gap-2">
            {sorts.map((option) => {
              const selected = draft.sort === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={SORT_LABELS[option]}
                  onPress={() => setDraft((current) => ({ ...current, sort: option }))}
                >
                  <Chip
                    label={SORT_LABELS[option]}
                    tone={selected ? 'primary' : 'neutral'}
                    {...(selected ? { icon: 'checkmark' as const } : {})}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {ratingApplies ? (
          <View className="border-t border-line py-4">
            <View className="mb-3 flex-row items-baseline justify-between">
              <Txt variant="overline" tone="subtle" serif={false} uppercase>
                Valoración mínima
              </Txt>
              <Txt variant="caption" tone="subtle">
                {draft.minRating ? `${draft.minRating} o más` : 'Cualquiera'}
              </Txt>
            </View>
            <View className="flex-row items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const on = (draft.minRating ?? 0) >= star;
                return (
                  <PressableScale
                    key={star}
                    accessibilityLabel={`${star} estrellas o más`}
                    scaleTo={0.85}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        minRating: current.minRating === star ? null : star,
                      }))
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
            </View>
            <Txt variant="caption" tone="subtle" className="mt-2">
              Lo que no tenga nota se queda fuera: sin nota no es cero estrellas.
            </Txt>
          </View>
        ) : null}

        <View className="h-4" />
      </ScrollView>
    </Sheet>
  );
}
