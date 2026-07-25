import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Divider } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import { useDefaultVisibility } from './useDefaultVisibility';
import { ENTITY_LABEL, VISIBILITY_META, type ShareableEntity } from './visibility';
import { VisibilityField } from './VisibilityField';

const ENTITIES: ShareableEntity[] = ['visit', 'restaurant', 'dish'];

/**
 * The standing answer to "who sees what I log".
 *
 * One row per kind, because the useful answer is rarely the same for all
 * three — sharing the places you like while keeping who you ate with to
 * yourself is a perfectly ordinary thing to want, and a single app-wide switch
 * cannot express it.
 *
 * This is only the starting point: every entry can override it when created or
 * afterwards.
 */
export function PrivacyCard() {
  const [editing, setEditing] = useState<ShareableEntity | null>(null);

  return (
    <View className="rounded-xl border border-line bg-surface">
      {ENTITIES.map((entity, index) => (
        <View key={entity}>
          {index > 0 ? <Divider /> : null}
          <EntityRow entity={entity} onPress={() => setEditing(entity)} />
        </View>
      ))}

      {editing ? <EntitySheet entity={editing} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function EntityRow({ entity, onPress }: { entity: ShareableEntity; onPress: () => void }) {
  const { colors } = useTheme();
  const { value } = useDefaultVisibility(entity);
  const meta = VISIBILITY_META[value];

  return (
    <PressableScale
      accessibilityLabel={`${ENTITY_LABEL[entity]}: ${meta.label}`}
      onPress={onPress}
      scaleTo={0.99}
      className="flex-row items-center gap-3 px-4 py-3.5"
    >
      <View className="min-w-0 flex-1">
        <Txt variant="body" weight="semi" serif={false}>
          {ENTITY_LABEL[entity]}
        </Txt>
        <Txt variant="caption" tone="subtle">
          {meta.label}
        </Txt>
      </View>
      <Ionicons name={meta.icon} size={16} color={colors.inkSubtle} />
      <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />
    </PressableScale>
  );
}

function EntitySheet({ entity, onClose }: { entity: ShareableEntity; onClose: () => void }) {
  const { value, update } = useDefaultVisibility(entity);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={ENTITY_LABEL[entity]}
      subtitle="Quién los ve, salvo que digas otra cosa en uno concreto"
      maxHeightRatio={0.65}
    >
      <View className="px-5 pb-4 pt-1">
        <VisibilityField
          value={value}
          onChange={(next) => {
            void update(next);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
