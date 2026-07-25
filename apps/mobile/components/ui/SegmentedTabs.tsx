import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

import { elevation } from '@/lib/design/tokens';

import { Txt } from './Txt';

export interface SegmentedTab {
  key: string;
  label: string;
  render: () => ReactNode;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  initialKey?: string | undefined;
}

const SELECT_SPRING = { damping: 26, stiffness: 300, mass: 0.6 };

/**
 * In-screen tab switcher.
 *
 * v1 used a material-top-tabs navigator for this, but these tabs are not routes
 * — they never appeared in the URL and carried no navigation state. A plain
 * component removes a banned dependency (expo-router forbids hand-rolled
 * react-navigation navigators since SDK 56) and is far less machinery.
 *
 * Rendered as a segmented control on a recessed track rather than as an
 * underline: an underline reads as page-level navigation, and these switch
 * content *within* a page, one level below the header that already uses one.
 */
export function SegmentedTabs({ tabs, initialKey }: SegmentedTabsProps) {
  const [activeKey, setActiveKey] = useState(initialKey ?? tabs[0]?.key ?? '');

  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.key === activeKey),
    0,
  );
  const activeTab = tabs[activeIndex];

  return (
    <View className="flex-1">
      <View className="mx-5 my-3 flex-row rounded-pill bg-sunken p-1">
        {tabs.map((tab, index) => (
          <Segment
            key={tab.key}
            label={tab.label}
            selected={index === activeIndex}
            onPress={() => setActiveKey(tab.key)}
          />
        ))}
      </View>

      <View className="flex-1">{activeTab?.render()}</View>
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const progress = useDerivedValue(() => withSpring(selected ? 1 : 0, SELECT_SPRING), [selected]);

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className="flex-1 items-center justify-center py-2"
    >
      <Animated.View
        pointerEvents="none"
        style={[thumbStyle, selected ? elevation.low : undefined]}
        className="absolute inset-0 rounded-pill bg-surface"
      />
      <Txt
        variant="callout"
        serif={false}
        weight={selected ? 'bold' : 'semi'}
        tone={selected ? 'ink' : 'subtle'}
        numberOfLines={1}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
