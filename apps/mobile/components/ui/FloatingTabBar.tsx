import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';

import { Txt } from './Txt';

import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Derived from the navigator itself: expo-router ships its own copy of the
// bottom-tabs types, and importing @react-navigation's directly gives a
// near-identical type that does not structurally match.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Filled when active, outline when not — the cheapest way to read "you are here". */
const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'home', off: 'home-outline' },
  feed: { on: 'people', off: 'people-outline' },
  'restaurants/index': { on: 'restaurant', off: 'restaurant-outline' },
  'dishes/index': { on: 'fast-food', off: 'fast-food-outline' },
  profile: { on: 'person-circle', off: 'person-circle-outline' },
};

const SELECT_SPRING = { damping: 16, stiffness: 260, mass: 0.6 };

/**
 * A tab bar that floats above the content instead of being welded to the
 * bottom edge.
 *
 * The default bar is a full-width strip with a hairline on top, which pins the
 * whole app to the bottom of the screen and makes every list end in a grey
 * band. A rounded, inset bar lets the canvas run underneath and gives the
 * screen a bottom margin the design otherwise has to fake.
 *
 * The active tab gets a tinted pill rather than just a colour change: colour
 * alone is a poor signal, and it is the one place in the app that wants a
 * moving element.
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="absolute inset-x-0 bottom-0 items-center px-5 pt-2"
    >
      <View
        style={[elevation.medium, { backgroundColor: colors.surfaceAlt }]}
        className="w-full flex-row items-center justify-between rounded-pill border border-line px-2 py-2"
      >
        {state.routes.map((route, index) => {
          const label = descriptors[route.key]?.options.title ?? route.name;
          const focused = state.index === index;
          const icons = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabButton
              key={route.key}
              focused={focused}
              label={label}
              icon={focused ? icons.on : icons.off}
              activeColor={colors.primary}
              inactiveColor={colors.inkSubtle}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  focused,
  label,
  icon,
  activeColor,
  inactiveColor,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: IconName;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const progress = useDerivedValue(() => withSpring(focused ? 1 : 0, SELECT_SPRING), [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -1]) }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-1 items-center"
    >
      <View className="items-center justify-center rounded-pill px-3 py-1.5">
        <Animated.View
          pointerEvents="none"
          style={pillStyle}
          className="absolute inset-0 rounded-pill bg-primary/12"
        />
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={21} color={focused ? activeColor : inactiveColor} />
        </Animated.View>
        <Txt
          variant="overline"
          weight={focused ? 'bold' : 'semi'}
          serif={false}
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontSize: 9.5,
            letterSpacing: 0.2,
            color: focused ? activeColor : inactiveColor,
          }}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}
