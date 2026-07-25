import { View } from 'react-native';

/**
 * The app's burger mark, monochrome, drawn without an SVG renderer.
 *
 * The shape is four stacked bands — a domed bun, two fillings, a flat base —
 * which is exactly what plain views with border radii describe. Pulling in
 * `react-native-svg` for one 16px glyph would mean a native module in the build
 * for a shape that is pure geometry, and native rendering libraries are what
 * has hurt this project's upgrades before (docs/11).
 *
 * Proportions follow the source SVG on a 24-unit grid: bun to y≈10, fillings at
 * 11.2 and 14.3, base from 17.4.
 */
export function BurgerGlyph({
  size = 16,
  color,
  /**
   * Colour of the sesame seeds. They are punched out of the bun, so this has
   * to be whatever sits behind the glyph. Omit below ~18px, where three dots
   * inside a 10px dome just read as noise.
   */
  seedColor,
}: {
  size?: number;
  color: string;
  seedColor?: string | undefined;
}) {
  const unit = size / 24;
  const gap = 1.2 * unit;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <View
        style={{
          height: 8 * unit,
          backgroundColor: color,
          borderTopLeftRadius: size / 2,
          borderTopRightRadius: size / 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.8 * unit,
          paddingTop: 3 * unit,
        }}
      >
        {seedColor
          ? [0, 1, 2].map((seed) => (
              <View
                key={seed}
                style={{
                  width: 1.8 * unit,
                  height: 1.8 * unit,
                  borderRadius: unit,
                  backgroundColor: seedColor,
                }}
              />
            ))
          : null}
      </View>

      <View style={{ height: gap }} />
      <View style={{ height: 1.9 * unit, borderRadius: unit, backgroundColor: color }} />
      <View style={{ height: gap }} />
      <View style={{ height: 1.9 * unit, borderRadius: unit, backgroundColor: color }} />
      <View style={{ height: gap }} />

      <View
        style={{
          height: 3.4 * unit,
          backgroundColor: color,
          borderBottomLeftRadius: size / 2,
          borderBottomRightRadius: size / 2,
        }}
      />
    </View>
  );
}
