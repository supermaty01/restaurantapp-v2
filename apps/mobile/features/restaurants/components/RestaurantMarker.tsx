import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

import { BurgerGlyph } from '@/components/ui/BurgerGlyph';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * One of your places on the map.
 *
 * The default pin is a red teardrop identical to every other pin Google draws,
 * so your diary was indistinguishable from the map's own points of interest —
 * on a map whose whole purpose is "where have I been", that is the one thing it
 * had to show. This one carries the app's colour and its rating, so a glance
 * tells you both that it is yours and whether it was any good.
 */
export function RestaurantMarker({
  latitude,
  longitude,
  name,
  rating,
  selected = false,
  onPress,
}: {
  latitude: number;
  longitude: number;
  name: string;
  rating: number | null;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      // The pin is drawn by us, so the callout would be a second, redundant UI.
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
      accessibilityLabel={name}
    >
      <View className="items-center">
        <View
          style={{ backgroundColor: selected ? colors.ink : colors.primary }}
          className="flex-row items-center gap-1 rounded-pill px-2.5 py-1.5"
        >
          <BurgerGlyph size={13} color={colors.onPrimary} />
          {rating ? (
            <>
              <Ionicons name="star" size={10} color={colors.accent} />
              <Txt
                variant="overline"
                weight="bold"
                serif={false}
                style={{ color: colors.onPrimary, letterSpacing: 0 }}
              >
                {rating}
              </Txt>
            </>
          ) : null}
        </View>
        {/* The stem, so the pill still points at a spot rather than floating. */}
        <View
          style={{
            width: 2,
            height: 7,
            backgroundColor: selected ? colors.ink : colors.primary,
          }}
        />
      </View>
    </Marker>
  );
}
