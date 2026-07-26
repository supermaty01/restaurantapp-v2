import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

import {
  EXPLICIT_VISIBILITIES,
  VISIBILITIES,
  VISIBILITY_META,
  type Visibility,
} from './visibility';

/**
 * Who sees this entry.
 *
 * Phrased as an audience ("solo yo", "mis amigos") rather than as a state
 * ("privado", "compartido"), because the question people actually have is who
 * is going to read it, and the words that answer that are the ones they use
 * out loud.
 *
 * The options are always visible instead of hidden behind a picker: this is a
 * decision with consequences, and a control that has to be opened to see its
 * current value is a control people stop checking.
 *
 * Two shapes. On an entry, "como mis ajustes" is one of the choices and the
 * usual one. On the settings screen itself it is not offered — a default that
 * deferred to itself would say nothing.
 */
export function VisibilityField({
  value,
  onChange,
  /** What "como mis ajustes" currently resolves to, shown next to that option. */
  resolvesTo,
  /** Settings screens pass `false`: there is no default to defer to there. */
  allowDefault = true,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  resolvesTo?: Visibility | undefined;
  allowDefault?: boolean;
}) {
  const { colors } = useTheme();
  const options = allowDefault ? VISIBILITIES : EXPLICIT_VISIBILITIES;

  return (
    <View className="gap-2">
      {options.map((option) => {
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
              {/* `flex-wrap`: el rótulo de "ahora" es tan largo como el nombre
                  del ajuste al que apunta, y en una fila rígida empujaba al
                  título fuera de la tarjeta. */}
              <View className="flex-row flex-wrap items-center gap-x-2">
                <Txt variant="body" weight="semi" serif={false}>
                  {meta.label}
                </Txt>
                {/* What deferring means right now. Without it the option is a
                    promise with no content, and nobody picks one of those. */}
                {option === 'default' && resolvesTo && resolvesTo !== 'default' ? (
                  <Txt variant="overline" tone="subtle" serif={false}>
                    AHORA: {VISIBILITY_META[resolvesTo].label.toUpperCase()}
                  </Txt>
                ) : null}
              </View>
              {/* Sin recortar: esto es lo que explica qué hace la opción, y
                  "Sigue tu configuración general, también si la c…" corta
                  justo antes de la mitad que aporta algo. Si no cabe en una
                  línea, que ocupe dos. */}
              <Txt variant="caption" tone="subtle">
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
