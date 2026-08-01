import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import type { FeedKind, UserEntrySort } from '../api';
import type { SectionOptions } from '../hooks/useUserSection';

/**
 * Filtrar y ordenar una sección del perfil de otra persona.
 *
 * Es el hermano pequeño de `FilterSheet`, no una copia: comparte el idioma —
 * píldoras, la fila de dirección debajo, un pie con Limpiar y Aplicar sobre un
 * borrador— pero no las opciones. Aquí no hay etiquetas ni visibilidades, porque
 * las etiquetas de otra persona no son las tuyas y su visibilidad ya la aplicó
 * el servidor: preguntar «¿quién lo ve?» sobre el diario de alguien sería
 * ofrecer un filtro cuya respuesta no depende de quien lo pulsa.
 *
 * Se descartó generalizar `FilterSheet` con banderas. Ese componente ya lleva
 * cuatro condicionales por tipo de entidad; una quinta dimensión —«y además esto
 * es de otra persona»— convertiría cada sección en una excepción que hay que
 * leer entera para saber qué se pinta.
 */
const SORT_LABELS: Record<UserEntrySort, string> = {
  date: 'Fecha',
  name: 'Nombre',
  rating: 'Valoración',
};

/**
 * Qué se puede ordenar en cada sección.
 *
 * Las visitas no llevan nota: lo que se puntúa es el sitio y el plato. Ofrecerla
 * sería un orden que no ordena nada, que es el mismo error que el panel del
 * diario ya cometió una vez con el filtro de restaurante sobre platos.
 */
const SORTS: Record<FeedKind, UserEntrySort[]> = {
  visit: ['date', 'name'],
  dish: ['date', 'name', 'rating'],
  restaurant: ['date', 'name', 'rating'],
};

/** Cómo se lee la dirección, en los términos del campo. */
function orderLabel(sort: UserEntrySort, descending: boolean): string {
  if (sort === 'name') return descending ? 'Z → A' : 'A → Z';
  if (sort === 'rating') return descending ? 'Mejor primero' : 'Peor primero';
  return descending ? 'Más recientes primero' : 'Más antiguas primero';
}

export function activeSectionFilterCount(options: SectionOptions): number {
  return options.minRating !== null ? 1 : 0;
}

export function SectionFilterSheet({
  visible,
  onClose,
  kind,
  options,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  kind: FeedKind;
  options: SectionOptions;
  onApply: (options: SectionOptions) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<SectionOptions>(options);

  // Se resiembra al abrir, así que cerrar sin aplicar deja la lista en paz.
  useEffect(() => {
    if (visible) setDraft(options);
  }, [visible, options]);

  const sorts = SORTS[kind];
  const ratingApplies = kind !== 'visit';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrar y ordenar"
      footer={
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label="Limpiar"
              variant="secondary"
              block
              disabled={draft.minRating === null}
              onPress={() => setDraft((current) => ({ ...current, minRating: null }))}
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
        <Section title="Ordenar por">
          <View className="flex-row flex-wrap gap-2">
            {sorts.map((sort) => (
              <Pressable
                key={sort}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.sort === sort }}
                accessibilityLabel={SORT_LABELS[sort]}
                onPress={() => setDraft((current) => ({ ...current, sort }))}
              >
                <Chip
                  label={SORT_LABELS[sort]}
                  tone={draft.sort === sort ? 'primary' : 'neutral'}
                  {...(draft.sort === sort ? { icon: 'checkmark' as const } : {})}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setDraft((current) => ({ ...current, descending: !current.descending }))}
            className="mt-2.5 flex-row items-center gap-2 self-start rounded-pill bg-sunken px-3 py-2"
          >
            <Ionicons
              name={draft.descending ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={colors.inkMuted}
            />
            <Txt variant="caption" tone="muted" weight="semi" serif={false}>
              {orderLabel(draft.sort, draft.descending)}
            </Txt>
          </Pressable>
        </Section>

        {ratingApplies ? (
          <Section
            title="Valoración mínima"
            hint={draft.minRating ? `${draft.minRating} o más` : 'Cualquiera'}
          >
            <View className="flex-row items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <PressableScale
                  key={star}
                  accessibilityLabel={`${star} estrellas o más`}
                  scaleTo={0.85}
                  // Tocar el valor actual lo quita: si no, no hay vuelta a
                  // «cualquiera» sin ir al botón de limpiar.
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
                    color={(draft.minRating ?? 0) >= star ? colors.accent : colors.lineStrong}
                  />
                </PressableScale>
              ))}
            </View>
          </Section>
        ) : null}

        <View className="h-4" />
      </ScrollView>
    </Sheet>
  );
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
