import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { TAG_HUES, neutralShades, onColor, shadesOf } from '@/lib/design/colour';

/** The hue whose shade row is closest to the current colour. */
function hueOf(color: string, palettes: { hue: number; shades: string[] }[]): number | 'neutral' {
  for (const { hue, shades } of palettes) {
    if (shades.includes(color.toLowerCase())) return hue;
  }
  return 'neutral';
}

/**
 * Colour for a tag: pick a hue, then how deep.
 *
 * A chromatic wheel was the obvious idea and the wrong one. It hands out
 * near-whites, near-blacks and muddy mid-tones — colours a tag cannot be, since
 * tags are read at a glance in a list and have to stay apart from each other
 * and legible on both surfaces. It also needs precise dragging on a small
 * target for a one-second decision, and React Native has no conic gradient, so
 * drawing a real wheel means an image or a dependency.
 *
 * Two rows give 70 colours instead of 12, every one of them usable, in two
 * taps. `colour.test.ts` holds each to WCAG AA on both themes.
 */
export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const palettes = useMemo(() => TAG_HUES.map((hue) => ({ hue, shades: shadesOf(hue) })), []);
  const neutrals = useMemo(() => neutralShades(), []);

  const activeHue = hueOf(value, palettes);
  const shades = activeHue === 'neutral' ? neutrals : shadesOf(activeHue);

  /** Keeps the depth when switching hue, so browsing does not reset your pick. */
  const depth = Math.max(shades.indexOf(value.toLowerCase()), 2);

  return (
    <View className="gap-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {palettes.map(({ hue, shades: hueShades }) => {
          const swatch = hueShades[2] as string;
          const active = activeHue === hue;
          return (
            <PressableScale
              key={hue}
              accessibilityLabel={`Tono ${hue}`}
              onPress={() => onChange(hueShades[depth] as string)}
              scaleTo={0.86}
              style={{ backgroundColor: swatch }}
              className={`h-10 w-10 items-center justify-center rounded-pill ${
                active ? 'border-2 border-ink' : ''
              }`}
            >
              {active ? <Ionicons name="checkmark" size={16} color={onColor(swatch)} /> : null}
            </PressableScale>
          );
        })}

        <PressableScale
          accessibilityLabel="Tono neutro"
          onPress={() => onChange(neutrals[depth] as string)}
          scaleTo={0.86}
          style={{ backgroundColor: neutrals[2] as string }}
          className={`h-10 w-10 items-center justify-center rounded-pill ${
            activeHue === 'neutral' ? 'border-2 border-ink' : ''
          }`}
        >
          {activeHue === 'neutral' ? (
            <Ionicons name="checkmark" size={16} color={onColor(neutrals[2] as string)} />
          ) : null}
        </PressableScale>
      </ScrollView>

      <View className="gap-1.5">
        <Txt variant="caption" tone="subtle">
          Intensidad
        </Txt>
        <View className="flex-row gap-2">
          {shades.map((shade, index) => {
            const active = shade === value.toLowerCase();
            return (
              <PressableScale
                key={shade}
                accessibilityLabel={`Intensidad ${index + 1}`}
                onPress={() => onChange(shade)}
                scaleTo={0.9}
                style={{ backgroundColor: shade }}
                className={`h-12 flex-1 items-center justify-center rounded-lg ${
                  active ? 'border-2 border-ink' : ''
                }`}
              >
                {active ? <Ionicons name="checkmark" size={17} color={onColor(shade)} /> : null}
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}
