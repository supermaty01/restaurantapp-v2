import { useEffect, useState } from 'react';
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

  const [tracking, setTracking] = useState(true);

  useEffect(() => {
    // Two frames is enough for layout to settle; a timeout rather than
    // onLayout because the tip and the glyph are separate children and only
    // the last one to land matters.
    const timer = setTimeout(() => setTracking(false), 220);
    return () => clearTimeout(timer);
  }, [selected]);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      // Starts true, then stops.
      //
      // With `false` from mount, react-native-maps takes a single snapshot of
      // the marker view — and takes it before the children have laid out, so
      // it captured the circle's background and nothing else: no glyph, no
      // tip. Leaving it true forever is the other extreme: every marker view
      // re-renders each frame and a screenful drags the whole map.
      tracksViewChanges={tracking}
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
