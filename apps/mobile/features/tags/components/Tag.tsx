import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { readableInk, withAlpha } from '@/lib/design/colour';

export interface TagProps {
  name: string;
  color: string;
  deleted?: boolean | undefined;
}

/**
 * A user-defined tag (docs/14).
 *
 * Clay renders these as tinted pills — the tag's colour as text on a wash of
 * itself — rather than as solid blocks, which is what kept a row of tags from
 * shouting over the content it labels.
 *
 * The text colour is adjusted against the surface it sits on, in whichever
 * direction helps: tag colours are user-chosen, and the default palette is full
 * of pale yellows and pinks that vanish on their own tint in light mode, while
 * darkening them would make them vanish in dark mode instead.
 */
const Tag = React.memo<TagProps>(({ name, color, deleted }) => {
  const { colors } = useTheme();

  return (
    <View
      style={{ backgroundColor: withAlpha(color, 0.18), opacity: deleted ? 0.5 : 1 }}
      className="flex-row items-center gap-1 rounded-pill px-2.5 py-1"
    >
      {deleted ? <View className="h-1.5 w-1.5 rounded-pill bg-danger" /> : null}
      <Text style={{ color: readableInk(color, colors.surface) }} className="font-bold text-[11px]">
        {name}
      </Text>
    </View>
  );
});

Tag.displayName = 'Tag';

export default Tag;
