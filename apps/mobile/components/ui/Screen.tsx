import { ScrollView, View } from 'react-native';

import type { ReactNode } from 'react';
import type { RefreshControlProps } from 'react-native';

/**
 * The page frame: the warm canvas plus the gutter the whole design is built on.
 *
 * Screens should not set their own background — that is how v1 ended up with
 * three slightly different greys — and should not repeat the padding.
 *
 * `tabBar` adds room for the floating tab bar, which overlays the content
 * rather than displacing it; without it the last row of every tab screen sits
 * under the bar.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  tabBar = false,
  refreshControl,
  className = '',
  contentClassName = '',
}: {
  children: ReactNode;
  /** Wraps the content in a ScrollView. Never use with a FlatList inside. */
  scroll?: boolean;
  padded?: boolean;
  /** Leaves room at the bottom for the floating tab bar. */
  tabBar?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps> | undefined;
  className?: string;
  contentClassName?: string;
}) {
  const padding = padded ? 'px-5' : '';
  const bottom = tabBar ? 'pb-28' : 'pb-8';

  if (scroll) {
    return (
      <ScrollView
        className={`flex-1 bg-canvas ${className}`}
        contentContainerClassName={`${padding} ${bottom} ${contentClassName}`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...(refreshControl ? { refreshControl } : {})}
      >
        {children}
      </ScrollView>
    );
  }

  return <View className={`flex-1 bg-canvas ${padding} ${className}`}>{children}</View>;
}
