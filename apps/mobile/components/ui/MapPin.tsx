import { View } from 'react-native';

import { BurgerGlyph } from './BurgerGlyph';

/**
 * A teardrop pin whose tip marks the exact spot.
 *
 * Built as a circle with a triangle under it rather than as a rotated square.
 * The rotated version was clipped: turning a square 45° needs a box √2 times
 * its side, and react-native-maps sizes a custom marker to its unrotated
 * bounds, so the corners — including the tip — were cut off.
 *
 * The triangle is the border trick: a zero-sized box whose left and right
 * borders are transparent and whose top border is the fill.
 */
export function MapPin({
  size = 34,
  color,
  glyphColor,
  borderColor,
}: {
  size?: number;
  color: string;
  glyphColor: string;
  /** Outline, so the pin stays visible over a busy map. */
  borderColor?: string | undefined;
}) {
  const tipHeight = size * 0.32;
  const tipWidth = size * 0.34;

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          ...(borderColor ? { borderWidth: 2, borderColor } : {}),
        }}
      >
        <BurgerGlyph size={size * 0.55} color={glyphColor} />
      </View>

      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: tipWidth / 2,
          borderRightWidth: tipWidth / 2,
          borderTopWidth: tipHeight,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: borderColor ?? color,
        }}
      />
    </View>
  );
}
