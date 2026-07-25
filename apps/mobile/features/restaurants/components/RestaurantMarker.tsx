import { Marker } from 'react-native-maps';

import { MapPin } from '@/components/ui/MapPin';
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
      <MapPin
        size={selected ? 40 : 34}
        color={selected ? colors.ink : colors.primary}
        glyphColor={colors.onPrimary}
        borderColor={colors.onPrimary}
      />
    </Marker>
  );
}
