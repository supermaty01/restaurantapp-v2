import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { fonts } from '@/lib/design/tokens';

import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Bottom tabs (docs/08).
 *
 * The information architecture changed with the redesign. v1 had four peer
 * lists — Restaurantes, Platos, Visitas, Etiquetas — which gave equal weight to
 * a browsing dimension (tags) and left nowhere for the social half of the app.
 * Now: a dashboard, the friend feed, the two collections you actually browse,
 * and your account. Visitas and Etiquetas are one tap away as full screens
 * (from Inicio and Perfil respectively) rather than permanent tabs.
 *
 * v1 also swiped between tabs, via @react-navigation/material-top-tabs pinned
 * to the bottom. SDK 56 dropped hand-rolled navigators, so that is still gone.
 */
function tabIcon(name: IconName) {
  const Icon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size ?? 23} color={color} />
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: colors.surfaceAlt,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          // Android draws a shadow under the bar that fights the flat design.
          elevation: 0,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.bodySemi },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: tabIcon('home-outline') }}
      />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: tabIcon('people-outline') }} />
      <Tabs.Screen
        name="restaurants/index"
        options={{ title: 'Lugares', tabBarIcon: tabIcon('restaurant-outline') }}
      />
      <Tabs.Screen
        name="dishes/index"
        options={{ title: 'Platos', tabBarIcon: tabIcon('fast-food-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
