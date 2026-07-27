import { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';

import { useDefaultVisibility } from './useDefaultVisibility';
import { useSharingAvailable } from './useSharingAvailable';
import { ENTITY_LABEL, type ShareableEntity, type Visibility } from './visibility';
import { VisibilityBadge, VisibilityField } from './VisibilityField';

/**
 * Who can see this, changeable from where you are looking at it.
 *
 * Deciding to share a meal almost always happens *after* logging it — you find
 * out it was worth sharing by eating it. Making that a trip through the edit
 * form means passing a screen full of fields you do not want to touch, next to
 * a Save button, for a one-tap decision. So the badge on the detail screen is
 * the control, not a label about one.
 *
 * It also has to be visible when it is *not* being changed. A diary that hides
 * what is shared is a diary you stop trusting, and the two states have to be
 * distinguishable at a glance rather than by opening something.
 */
export function VisibilityControl({
  value,
  entity,
  onChange,
}: {
  value: Visibility;
  entity: ShareableEntity;
  /** Applied immediately; there is no Save here, the badge *is* the decision. */
  onChange: (next: Visibility) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { value: fallsBackTo } = useDefaultVisibility(entity);
  const sharing = useSharingAvailable();

  // Se defiende solo además de que las pantallas lo escondan: así un sitio de
  // uso nuevo no puede olvidarse de la regla.
  if (!sharing) return null;

  return (
    <>
      <VisibilityBadge value={value} onPress={() => setOpen(true)} />

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="¿Quién puede ver esto?"
        subtitle={ENTITY_LABEL[entity]}
      >
        <View className="gap-3 px-5 pb-2">
          <VisibilityField
            resolvesTo={fallsBackTo}
            value={value}
            onChange={(next) => {
              void onChange(next);
              // Closing on choice: there is one decision here and nothing to
              // confirm, so a Save button would only be a second tap.
              setOpen(false);
            }}
          />
          <Txt variant="caption" tone="subtle">
            Cambiarlo aquí no toca nada más de la entrada.
          </Txt>
        </View>
      </Sheet>
    </>
  );
}
