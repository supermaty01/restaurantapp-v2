import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

export interface SegmentedTab {
  key: string;
  label: string;
  render: () => ReactNode;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  initialKey?: string | undefined;
}

/**
 * In-screen tab switcher.
 *
 * v1 used a material-top-tabs navigator for this, but these tabs are not routes
 * — they never appeared in the URL and carried no navigation state. A plain
 * component removes a banned dependency (expo-router forbids hand-rolled
 * react-navigation navigators since SDK 56) and is far less machinery.
 */
export function SegmentedTabs({ tabs, initialKey }: SegmentedTabsProps) {
  const { colors } = useTheme();
  const [activeKey, setActiveKey] = useState(initialKey ?? tabs[0]?.key ?? '');

  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const accent = colors.primary;
  const inactive = colors.inkMuted;

  return (
    <View className="flex-1">
      <View className="flex-row border-b border-line bg-surface">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab?.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveKey(tab.key)}
              className="flex-1 items-center py-3"
              style={{
                borderBottomWidth: 2,
                marginBottom: -1,
                borderBottomColor: isActive ? accent : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                className="font-semi text-[15px]"
                style={{ color: isActive ? accent : inactive }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1">{activeTab?.render()}</View>
    </View>
  );
}
