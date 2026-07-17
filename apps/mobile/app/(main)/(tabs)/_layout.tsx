import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/lib/context/ThemeContext';

/**
 * Bottom tabs via expo-router.
 *
 * v1 used @react-navigation/material-top-tabs pinned to the bottom to get
 * swipe-between-tabs. SDK 56 dropped support for hand-rolled react-navigation
 * navigators, so swiping is gone for now; the navigation model is being
 * redesigned anyway in phase 6 (docs/08-ui.md).
 */
export default function TabsLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? '#B27A4D' : '#905c36',
        tabBarInactiveTintColor: isDarkMode ? '#A09A8C' : '#6b6246',
        tabBarStyle: { backgroundColor: isDarkMode ? '#2A2A2A' : '#cdc8b8' },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="restaurants/index"
        options={{
          title: 'Restaurantes',
          tabBarIcon: ({ color }) => <Ionicons name="restaurant-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dishes/index"
        options={{
          title: 'Platos',
          tabBarIcon: ({ color }) => <Ionicons name="fast-food-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visits/index"
        options={{
          title: 'Visitas',
          tabBarIcon: ({ color }) => <Ionicons name="eye-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tags/index"
        options={{
          title: 'Etiquetas',
          tabBarIcon: ({ color }) => <Ionicons name="pricetag-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
