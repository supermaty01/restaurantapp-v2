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
  initialKey?: string;
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
  const { isDarkMode } = useTheme();
  const [activeKey, setActiveKey] = useState(initialKey ?? tabs[0]?.key ?? '');

  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const accent = isDarkMode ? '#7A9455' : '#93AE72';
  const inactive = isDarkMode ? '#a0a0a0' : '#6b7280';

  return (
    <View className="flex-1">
      <View className="flex-row bg-card dark:bg-dark-card">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab?.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveKey(tab.key)}
              className="flex-1 items-center py-3"
              style={{
                borderBottomWidth: 3,
                borderBottomColor: isActive ? accent : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text className="text-base font-bold" style={{ color: isActive ? accent : inactive }}>
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
