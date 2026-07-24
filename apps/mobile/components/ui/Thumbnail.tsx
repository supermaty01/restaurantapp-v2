import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { gradientFor } from '@/lib/design/tokens';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * A square image for a restaurant, dish or visit.
 *
 * When there is no photo — which is most rows in a real diary — it falls back
 * to a warm two-tone block keyed off the name instead of a grey box, so a list
 * of photoless entries still looks intentional. The gradient is faked with two
 * stacked layers rather than pulling in a gradient dependency.
 */
export function Thumbnail({
  name,
  uri,
  size = 66,
  radius = 11,
  icon,
  aspectRatio,
  className = '',
}: {
  name: string;
  uri?: string | null | undefined;
  /** Side length of the square. Ignored when `aspectRatio` is given. */
  size?: number;
  radius?: number;
  /** Drawn over the placeholder to hint at what the row is. */
  icon?: IconName;
  /** Stretches to the parent's width at this ratio, for banners and covers. */
  aspectRatio?: number;
  className?: string;
}) {
  const [from, to] = gradientFor(name);
  const box = aspectRatio ? { width: '100%' as const, aspectRatio } : { width: size, height: size };
  // The wedge is sized off the longest edge so it covers the corner either way.
  const span = aspectRatio ? size * 3 : size;

  return (
    <View
      style={{ ...box, borderRadius: radius, backgroundColor: from }}
      className={`overflow-hidden ${className}`}
    >
      {uri ? (
        <Image
          source={uri}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          transition={150}
        />
      ) : (
        <>
          {/* Diagonal wedge of the darker tone, standing in for a gradient. */}
          <View
            style={{
              position: 'absolute',
              right: -span * 0.35,
              bottom: -span * 0.35,
              width: span * 1.2,
              height: span * 1.2,
              borderRadius: span,
              backgroundColor: to,
              opacity: 0.85,
            }}
          />
          {icon ? (
            <View className="flex-1 items-center justify-center">
              <Ionicons name={icon} size={Math.round(size * 0.34)} color="#FFFFFF" />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
