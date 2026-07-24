import { ScrollView, View } from 'react-native';

import type { ReactNode } from 'react';

/**
 * The page frame: the warm canvas plus consistent horizontal padding.
 *
 * Screens should not set their own background — that is how v1 ended up with
 * three slightly different greys — and should not repeat the 20px gutter the
 * whole design is built on.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  className = '',
  contentClassName = '',
}: {
  children: ReactNode;
  /** Wraps the content in a ScrollView. Never use with a FlatList inside. */
  scroll?: boolean;
  padded?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const padding = padded ? 'px-5' : '';

  if (scroll) {
    return (
      <ScrollView
        className={`flex-1 bg-canvas ${className}`}
        contentContainerClassName={`${padding} pb-8 ${contentClassName}`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View className={`flex-1 bg-canvas ${padding} ${className}`}>{children}</View>;
}
