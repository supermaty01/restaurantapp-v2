import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { onColor, readableInk, withAlpha } from '@/lib/design/colour';
import { useDatabase } from '@/lib/hooks/useDatabase';

import CreateTagModal from './CreateTagModal';
import { useTagsList } from '../hooks/useTagsList';
import { useTagUsage } from '../hooks/useTagUsage';
import { createTag } from '../repositories/tagRepository';

import type { TagDTO } from '../types/tag-dto';

/** How many suggestions fit before the row stops being scannable. */
const INLINE_SUGGESTIONS = 6;

/**
 * Tagging, without leaving the form.
 *
 * Tagging used to mean: press a `+`, wait for a modal, hunt through a list,
 * close the modal, check what stuck. Four steps and a context switch for what
 * is usually "the usual two tags".
 *
 * Here the tags you already use most are right there as chips — one tap on, one
 * tap off — and the sheet is only for the long tail. That is the difference
 * between a form field and a control you actually enjoy using.
 */
export function TagField({
  selected,
  onChange,
}: {
  selected: TagDTO[];
  onChange: (next: TagDTO[]) => void;
}) {
  const { colors } = useTheme();
  const allTags = useTagsList();
  const usage = useTagUsage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const db = useDatabase();

  /**
   * Crear una etiqueta sin salir del formulario.
   *
   * Se perdió en el rediseño y hacía falta: la etiqueta que quieres suele
   * ocurrírsete escribiendo la entrada, y mandarte a Perfil › Etiquetas
   * significa abandonar un formulario a medio llenar para volver a él.
   *
   * La nueva queda seleccionada al crearla, que es evidentemente lo que querías
   * al crearla desde aquí.
   */
  const handleCreate = async (input: { name: string; color: string }) => {
    const id = await createTag(db, input);
    onChange([...selected, { id, name: input.name, color: input.color, deleted: false }]);
    setCreating(false);
  };

  const isSelected = (tag: TagDTO) => selected.some((t) => t.id === tag.id);

  const toggle = (tag: TagDTO) =>
    onChange(isSelected(tag) ? selected.filter((t) => t.id !== tag.id) : [...selected, tag]);

  /** Unselected tags, most-used first: what you are most likely to want next. */
  const suggestions = useMemo(
    () =>
      allTags
        .filter((tag) => !isSelected(tag))
        .sort((a, b) => (usage.get(b.id)?.total ?? 0) - (usage.get(a.id)?.total ?? 0))
        .slice(0, INLINE_SUGGESTIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTags, usage, selected],
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term ? allTags.filter((tag) => tag.name.toLowerCase().includes(term)) : allTags;
    return [...pool].sort((a, b) => (usage.get(b.id)?.total ?? 0) - (usage.get(a.id)?.total ?? 0));
  }, [allTags, query, usage]);

  return (
    <View className="gap-2.5">
      {selected.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((tag) => (
            <TagChip key={tag.id} tag={tag} selected onPress={() => toggle(tag)} />
          ))}
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <View className="gap-1.5">
          {selected.length > 0 ? (
            <Txt variant="caption" tone="subtle">
              Sugerencias
            </Txt>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((tag) => (
              <TagChip key={tag.id} tag={tag} selected={false} onPress={() => toggle(tag)} />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todas las etiquetas"
              onPress={() => setSheetOpen(true)}
              className="flex-row items-center gap-1 rounded-pill border border-dashed border-line-strong px-3 py-1.5"
            >
              <Ionicons name="ellipsis-horizontal" size={13} color={colors.inkSubtle} />
              <Txt variant="overline" tone="subtle" serif={false} weight="bold">
                Todas
              </Txt>
            </Pressable>
          </ScrollView>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir etiquetas"
          onPress={() => setSheetOpen(true)}
          className="flex-row items-center gap-2 self-start rounded-pill border border-dashed border-line-strong px-3.5 py-2"
        >
          <Ionicons name="pricetag-outline" size={14} color={colors.inkSubtle} />
          <Txt variant="caption" tone="subtle" weight="semi" serif={false}>
            {allTags.length === 0 ? 'Aún no tienes etiquetas' : 'Elegir etiquetas'}
          </Txt>
        </Pressable>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Etiquetas"
        subtitle={
          selected.length === 0
            ? 'Toca para añadir o quitar'
            : `${selected.length} ${selected.length === 1 ? 'elegida' : 'elegidas'}`
        }
      >
        <View className="px-5 pb-2">
          <View className="flex-row items-center gap-2.5 rounded-pill border border-line bg-surface px-4 py-2.5">
            <Ionicons name="search" size={16} color={colors.inkSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar una etiqueta…"
              placeholderTextColor={colors.inkSubtle}
              autoCorrect={false}
              className="flex-1 text-ink"
              style={{ fontSize: 15, paddingVertical: 2 }}
            />
          </View>
        </View>

        {/* Con altura acotada: sin esto la rejilla crecía más allá del panel y
            en Android lo que se dibuja fuera del padre no recibe toques — las
            etiquetas de más abajo se veían y no se podían pulsar. Solo
            respondían las pocas que cabían, o las que dejaba una búsqueda. */}
        <ScrollView
          className="px-5"
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingBottom: 12, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.length === 0 ? (
            <EmptyState
              icon="pricetag-outline"
              title={query ? 'Nada con ese nombre' : 'Todavía no hay etiquetas'}
              message="Se crean desde Perfil › Etiquetas."
            />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {searchResults.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  selected={isSelected(tag)}
                  onPress={() => toggle(tag)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <View className="px-5 pb-1 pt-2">
          <PressableScale
            accessibilityLabel="Crear una etiqueta nueva"
            onPress={() => setCreating(true)}
            scaleTo={0.97}
            className="flex-row items-center justify-center gap-2 rounded-pill border border-dashed border-primary/40 bg-primary/8 px-4 py-2.5"
          >
            <Ionicons name="add" size={15} color={colors.primary} />
            <Txt variant="caption" weight="bold" serif={false} tone="primary">
              Nueva etiqueta
            </Txt>
          </PressableScale>
        </View>
      </Sheet>

      <CreateTagModal
        visible={creating}
        onClose={() => setCreating(false)}
        onAdd={(tag) => void handleCreate(tag)}
      />
    </View>
  );
}

/**
 * A tag as a toggle.
 *
 * Selected reads as filled in the tag's own colour; unselected as an outline of
 * it. The state is carried by fill, not by a tick — a checkbox next to a
 * coloured pill is two competing signals for one bit of information.
 */
function TagChip({
  tag,
  selected,
  onPress,
}: {
  tag: TagDTO;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const ink = readableInk(tag.color, colors.surface);

  return (
    <PressableScale
      accessibilityLabel={tag.name}
      onPress={onPress}
      scaleTo={0.94}
      className="flex-row items-center gap-1.5 rounded-pill px-3 py-1.5"
      style={{
        backgroundColor: selected ? withAlpha(tag.color, 0.9) : withAlpha(tag.color, 0.14),
        borderWidth: 1,
        borderColor: selected ? 'transparent' : withAlpha(tag.color, 0.35),
      }}
    >
      <Txt
        variant="caption"
        weight="bold"
        serif={false}
        numberOfLines={1}
        style={{ color: selected ? onColor(tag.color) : ink }}
      >
        {tag.name}
      </Txt>
      {selected ? <Ionicons name="close" size={12} color={onColor(tag.color)} /> : null}
    </PressableScale>
  );
}
