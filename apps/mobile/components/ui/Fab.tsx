import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';

import { PressableScale } from './Motion';
import { Txt } from './Txt';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The "add" button that floats over a list.
 *
 * `aboveTabBar` is not cosmetic: screens inside the tab navigator have the
 * floating bar over their bottom edge, and a button at the usual offset lands
 * underneath it.
 */
export function Fab({
  icon = 'add',
  label,
  onPress,
  accessibilityLabel,
  aboveTabBar = false,
}: {
  icon?: IconName;
  /** Turns the circle into a pill. Use where the action needs naming. */
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
  aboveTabBar?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.92}
      className={`absolute right-5 flex-row items-center justify-center gap-1.5 rounded-pill bg-primary ${
        aboveTabBar ? 'bottom-[104px]' : 'bottom-6'
      } ${label ? 'px-5 py-4' : 'h-14 w-14'}`}
      style={elevation.medium}
    >
      <Ionicons name={icon} size={label ? 18 : 26} color={colors.onPrimary} />
      {label ? (
        <Txt variant="callout" weight="bold" serif={false} tone="onPrimary">
          {label}
        </Txt>
      ) : null}
    </PressableScale>
  );
}
