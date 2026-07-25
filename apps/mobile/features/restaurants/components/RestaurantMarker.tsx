import { View } from 'react-native';
import { Marker } from 'react-native-maps';

import { BurgerGlyph } from '@/components/ui/BurgerGlyph';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * One of your places on the map.
 *
 * The default pin is a red teardrop identical to every other pin Google draws,
 * so your diary was indistinguishable from the map's own points of interest —
 * on a map whose whole purpose is "where have I been", that is the one thing it
 * had to show.
 *
 * Shaped as a teardrop rather than a floating pill: a pill only tells you
 * roughly where something is, and on a street map "roughly" is the wrong
 * answer. The tip is the coordinate.
 *
 * No rating here. A pin is a location, and a number tucked into one is read at
 * a glance only when there are three of them; with a screen full it is clutter.
 */
export function RestaurantMarker({
  latitude,
  longitude,
  name,
  selected = false,
  onPress,
}: {
  latitude: number;
  longitude: number;
  name: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fill = selected ? colors.ink : colors.primary;
  const size = selected ? 40 : 34;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      // Without this, react-native-maps re-renders every custom marker view on
      // each frame, and a screen of them drags the whole map.
      tracksViewChanges={false}
      // The tip, not the centre, sits on the coordinate.
      anchor={{ x: 0.5, y: 1 }}
      accessibilityLabel={name}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: fill,
            alignItems: 'center',
            justifyContent: 'center',
            // Three round corners and one square: rotated 45°, that is a
            // teardrop. The glyph inside is counter-rotated so it stays level.
            borderTopLeftRadius: size / 2,
            borderTopRightRadius: size / 2,
            borderBottomLeftRadius: size / 2,
            borderBottomRightRadius: 2,
            transform: [{ rotate: '45deg' }],
            borderWidth: 2,
            borderColor: colors.onPrimary,
          }}
        >
          <View style={{ transform: [{ rotate: '-45deg' }] }}>
            <BurgerGlyph size={size * 0.52} color={colors.onPrimary} />
          </View>
        </View>
      </View>
    </Marker>
  );
}
