import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { Sheet } from '@/components/ui/Sheet';
import { FieldLabel } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { ColorField } from '@/features/tags/components/ColorField';
import Tag from '@/features/tags/components/Tag';
import { useTheme } from '@/lib/context/ThemeContext';
import { TAG_HUES, shadesOf } from '@/lib/design/colour';

/**
 * The palette a tag can take.
 *
 * v1 offered 36 swatches across three horizontally paged screens — vivid,
 * pastel and a full greyscale ramp — with a dot indicator to page between them.
 * Choosing a label colour is not a task that deserves a carousel, and twelve
 * near-identical greys are twelve ways to make two tags indistinguishable.
 *
 * These are drawn from the Clay palette (docs/14), so a tag looks like it
 * belongs to the app rather than to a colour picker.
 */
/** Where a new tag starts: the app's own terracotta, mid depth. */
const DEFAULT_COLOR = shadesOf(TAG_HUES[1] as number)[2] as string;

interface CreateTagModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (tag: { name: string; color: string }) => void;
  onDelete?: ((tagId: number) => void) | undefined;
  editTag?: { id: number; name: string; color: string } | null;
  isEditing?: boolean | undefined;
}

/**
 * Creating and editing a tag.
 *
 * Rebuilt on the app's sheet, and reduced to what the task actually is: a name
 * and a colour. The preview at the top shows the tag exactly as it will appear
 * in a list, which is the only question a colour picker has to answer.
 */
export default function CreateTagModal({
  visible,
  onClose,
  onAdd,
  onDelete,
  editTag,
  isEditing = false,
}: CreateTagModalProps) {
  const { colors } = useTheme();
  const { ask } = useDialog();

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(editTag?.name ?? '');
    setColor(editTag?.color ?? DEFAULT_COLOR);
    setTouched(false);
  }, [visible, editTag]);

  const trimmed = name.trim();
  const invalid = touched && trimmed.length === 0;

  const submit = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    onAdd({ name: trimmed, color });
  };

  const confirmDelete = async () => {
    if (!editTag || !onDelete) return;
    const confirmed = await ask({
      title: `Eliminar «${editTag.name}»`,
      message: 'Dejará de estar disponible para etiquetar.',
      icon: 'trash-outline',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (confirmed) onDelete(editTag.id);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditing ? 'Editar etiqueta' : 'Nueva etiqueta'}
      maxHeightRatio={0.8}
      footer={
        <View className="flex-row gap-2.5">
          {isEditing && onDelete ? (
            <View className="flex-1">
              <Button
                label="Eliminar"
                variant="secondary"
                icon="trash-outline"
                block
                onPress={() => void confirmDelete()}
              />
            </View>
          ) : null}
          <View className={isEditing && onDelete ? 'flex-[1.4]' : 'flex-1'}>
            <Button
              label={isEditing ? 'Guardar' : 'Crear'}
              block
              disabled={trimmed.length === 0}
              onPress={submit}
            />
          </View>
        </View>
      }
    >
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* The tag as it will actually look. A swatch grid answers "which
            colour"; this answers "which tag", which is the real question. */}
        <View className="items-center rounded-xl border border-line bg-sunken py-6">
          <Tag name={trimmed || 'Tu etiqueta'} color={color} />
        </View>

        <View className="gap-2">
          <FieldLabel>Nombre</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => setTouched(true)}
            placeholder="Italiano, para llevar, sin gluten…"
            placeholderTextColor={colors.inkSubtle}
            autoFocus={!isEditing}
            maxLength={30}
            className={`rounded-lg border bg-surface px-4 py-3 text-ink ${
              invalid ? 'border-danger' : 'border-line-strong'
            }`}
            style={{ fontSize: 15 }}
          />
          {invalid ? (
            <Txt variant="caption" tone="danger">
              Ponle un nombre.
            </Txt>
          ) : null}
        </View>

        <View className="gap-2.5">
          <FieldLabel>Color</FieldLabel>
          <ColorField value={color} onChange={setColor} />
        </View>
      </ScrollView>
    </Sheet>
  );
}
