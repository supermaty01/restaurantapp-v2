import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';

import { useDialog } from '@/components/ui/Dialog';
import { Fab } from '@/components/ui/Fab';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import CreateTagModal from '@/features/tags/components/CreateTagModal';
import { useTagsList } from '@/features/tags/hooks/useTagsList';
import { useTagUsage } from '@/features/tags/hooks/useTagUsage';
import { createTag, softDeleteTag, updateTag } from '@/features/tags/repositories/tagRepository';
import type { TagDTO } from '@/features/tags/types/tag-dto';
import { useTheme } from '@/lib/context/ThemeContext';
import { readableInk, withAlpha } from '@/lib/design/colour';
import { reportError } from '@/lib/helpers/report-error';
import { useDatabase } from '@/lib/hooks/useDatabase';

/**
 * Tag management.
 *
 * The old screen was a list of names and colours with nothing to act on, which
 * is exactly why it felt pointless — you cannot decide whether to rename or
 * delete a tag without knowing what it labels.
 *
 * Two changes carry the redesign: every row says how many things carry the tag,
 * and the list splits into the ones in use and the ones that are not. Tidying up
 * unused tags is the main reason to open this screen, and alphabetical order
 * buries them among the thirty you never touch.
 */
export default function TagsScreen() {
  const drizzleDb = useDatabase();
  const tags = useTagsList(false);
  const usage = useTagUsage();
  const { ask } = useDialog();

  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagDTO | null>(null);

  const sections = useMemo(() => {
    const countOf = (tag: TagDTO) => usage.get(tag.id)?.total ?? 0;

    const used = tags.filter((tag) => countOf(tag) > 0).sort((a, b) => countOf(b) - countOf(a));
    const unused = tags
      .filter((tag) => countOf(tag) === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return [
      { key: 'used', title: 'En uso', hint: 'Las más usadas primero', data: used },
      { key: 'unused', title: 'Sin usar', hint: 'No etiquetan nada', data: unused },
    ].filter((section) => section.data.length > 0);
  }, [tags, usage]);

  const closeModal = () => {
    setSelectedTag(null);
    setModalVisible(false);
  };

  const handleSubmit = async (tagData: { id?: number; name: string; color: string }) => {
    try {
      if (selectedTag) {
        await updateTag(drizzleDb, selectedTag.id, { name: tagData.name, color: tagData.color });
      } else {
        await createTag(drizzleDb, { name: tagData.name, color: tagData.color });
      }
      closeModal();
      return { success: true };
    } catch (error) {
      reportError('No se pudo guardar la etiqueta', error);
      return { success: false, error: 'Error al procesar la etiqueta' };
    }
  };

  const handleDelete = async (tagId: number) => {
    const inUse = usage.get(tagId)?.total ?? 0;

    if (inUse > 0) {
      // It is a soft delete, so nothing is lost — but the tag disappearing from
      // things it labels is still a surprise worth naming first.
      const confirmed = await ask({
        title: 'Quitar la etiqueta',
        message: `Está en ${inUse} ${inUse === 1 ? 'elemento' : 'elementos'}. Dejará de aparecer en ellos.`,
        icon: 'pricetag-outline',
        confirmLabel: 'Quitar',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
      if (!confirmed) return { success: false, error: 'cancelado' };
    }

    try {
      await softDeleteTag(drizzleDb, tagId);
      closeModal();
      return { success: true };
    } catch (error) {
      reportError('No se pudo eliminar la etiqueta', error);
      return { success: false, error: 'Error al eliminar la etiqueta' };
    }
  };

  return (
    <Screen padded={false}>
      {tags.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title="Todavía no hay etiquetas"
          message="Sirven para agrupar lugares y platos: «italiano», «para llevar», «sin gluten»."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-5 pb-28"
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-baseline justify-between pb-2 pt-5">
              <Txt variant="overline" tone="subtle" serif={false} uppercase>
                {section.title} · {section.data.length}
              </Txt>
              <Txt variant="caption" tone="subtle">
                {section.hint}
              </Txt>
            </View>
          )}
          renderItem={({ item }) => (
            <TagRow
              tag={item}
              usage={usage.get(item.id)?.total ?? 0}
              onPress={() => {
                setSelectedTag(item);
                setModalVisible(true);
              }}
            />
          )}
        />
      )}

      <Fab
        onPress={() => {
          setSelectedTag(null);
          setModalVisible(true);
        }}
        accessibilityLabel="Nueva etiqueta"
      />

      <CreateTagModal
        visible={isModalVisible}
        onClose={closeModal}
        onAdd={handleSubmit}
        onDelete={handleDelete}
        editTag={selectedTag}
        isEditing={!!selectedTag}
      />
    </Screen>
  );
}

function TagRow({ tag, usage, onPress }: { tag: TagDTO; usage: number; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={`${tag.name}, en ${usage} elementos`}
      onPress={onPress}
      scaleTo={0.985}
      className="mb-2 flex-row items-center gap-3 rounded-xl border border-line bg-surface p-3"
    >
      <View
        style={{ backgroundColor: withAlpha(tag.color, 0.18) }}
        className="h-10 w-10 items-center justify-center rounded-pill"
      >
        <View style={{ backgroundColor: tag.color }} className="h-4 w-4 rounded-pill" />
      </View>

      <View className="min-w-0 flex-1">
        <Txt
          variant="heading"
          weight="bold"
          serif={false}
          numberOfLines={1}
          style={{ color: readableInk(tag.color, colors.surface) }}
        >
          {tag.name}
        </Txt>
        <Txt variant="caption" tone="subtle">
          {usage === 0 ? 'Sin usar' : `En ${usage} ${usage === 1 ? 'elemento' : 'elementos'}`}
        </Txt>
      </View>

      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </PressableScale>
  );
}
