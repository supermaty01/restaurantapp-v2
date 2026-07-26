import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

import { MapPin } from '@/components/ui/MapPin';
import { useTheme } from '@/lib/context/ThemeContext';
import { withAlpha } from '@/lib/design/colour';

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
      {/* Seleccionado = el mismo sitio, mirado más de cerca.
          Antes cambiaba a color tinta y conservaba el borde claro, y ese borde
          sobre un relleno oscuro se leía como un aro blanco suelto alrededor
          del icono en vez de como una selección. Ahora la señal es el tamaño y
          un halo *detrás* de la gota, que es lo que hace el mapa cuando quiere
          decir "este": el marcador sigue siendo reconociblemente el mismo. */}
      <View style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        {selected ? (
          <View
            style={{
              position: 'absolute',
              // Centrado sobre el círculo de la gota, no sobre el conjunto:
              // la punta cuelga por debajo y desplazaría el halo.
              bottom: 44 * 0.32,
              width: 44 * 1.5,
              height: 44 * 1.5,
              borderRadius: 44,
              backgroundColor: withAlpha(colors.primary, 0.22),
            }}
          />
        ) : null}
        <MapPin
          size={selected ? 44 : 34}
          color={colors.primary}
          glyphColor={colors.onPrimary}
          borderColor={colors.surface}
        />
      </View>
    </Marker>
  );
}
