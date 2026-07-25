import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import { VISIBILITIES, VISIBILITY_META, type Visibility } from './visibility';

/**
 * Who sees this entry.
 *
 * Phrased as an audience ("solo yo", "mis amigos") rather than as a state
 * ("privado", "compartido"), because the question people actually have is who
 * is going to read it, and the words that answer that are the ones they use
 * out loud.
 *
 * The three options are always visible instead of hidden behind a picker: this
 * is a decision with consequences, and a control that has to be opened to see
 * its current value is a control people stop checking.
 */
export function VisibilityField({
  value,
  onChange,
  /** Marks the option that came from the user's default, so overriding is visible. */
  defaultValue,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  defaultValue?: Visibility | undefined;
}) {
  const { colors } = useTheme();

  return (
    <View className="gap-2">
      {VISIBILITIES.map((option) => {
        const meta = VISIBILITY_META[option];
        const active = option === value;

        return (
          <PressableScale
            key={option}
            accessibilityLabel={`${meta.label}. ${meta.description}`}
            onPress={() => onChange(option)}
            scaleTo={0.985}
            className={`flex-row items-center gap-3 rounded-xl border p-3 ${
              active ? 'border-primary bg-primary/8' : 'border-line bg-surface'
            }`}
          >
            <View
              className={`h-9 w-9 items-center justify-center rounded-pill ${
                active ? 'bg-primary' : 'bg-sunken'
              }`}
            >
              <Ionicons
                name={meta.icon}
                size={17}
                color={active ? colors.onPrimary : colors.inkMuted}
              />
            </View>

            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Txt variant="body" weight="semi" serif={false}>
                  {meta.label}
                </Txt>
                {defaultValue === option ? (
                  <Txt variant="overline" tone="subtle" serif={false}>
                    POR DEFECTO
                  </Txt>
                ) : null}
              </View>
              <Txt variant="caption" tone="subtle" numberOfLines={1}>
                {meta.description}
              </Txt>
            </View>

            {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * The same choice as one compact row, for a detail screen.
 *
 * Changing who can see something you already logged has to be possible without
 * entering the edit form: deciding to share a meal usually happens *after* it,
 * once you know it was worth sharing.
 */
export function VisibilityBadge({
  value,
  onPress,
}: {
  value: Visibility;
  onPress?: (() => void) | undefined;
}) {
  const { colors } = useTheme();
  const meta = VISIBILITY_META[value];
  const shared = value !== 'private';

  return (
    <PressableScale
      accessibilityLabel={`Visibilidad: ${meta.label}`}
      {...(onPress ? { onPress } : {})}
      scaleTo={0.94}
      className={`flex-row items-center gap-1.5 self-start rounded-pill border px-3 py-1.5 ${
        shared ? 'border-sage/40 bg-sage/12' : 'border-line bg-surface'
      }`}
    >
      <Ionicons name={meta.icon} size={13} color={shared ? colors.sage : colors.inkSubtle} />
      <Txt variant="caption" weight="semi" serif={false} tone={shared ? 'ink' : 'subtle'}>
        {meta.label}
      </Txt>
      {onPress ? <Ionicons name="chevron-down" size={13} color={colors.inkSubtle} /> : null}
    </PressableScale>
  );
}
