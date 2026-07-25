import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

/**
 * Bottom tabs (docs/08, docs/14).
 *
 * The information architecture changed with the redesign. v1 had four peer
 * lists — Restaurantes, Platos, Visitas, Etiquetas — which gave equal weight to
 * a browsing dimension (tags) and left nowhere for the social half of the app.
 * Now: a dashboard, the friend feed, the two collections you actually browse,
 * and your account. Visitas and Etiquetas are one tap away as full screens
 * (from Inicio and Perfil respectively) rather than permanent tabs.
 *
 * The bar is drawn by FloatingTabBar and floats over the content, so screens
 * leave room for it with `pb-28` on their scrollable content.
 *
 * v1 also swiped between tabs, via @react-navigation/material-top-tabs pinned
 * to the bottom. SDK 56 dropped hand-rolled navigators, so that is still gone.
 */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="restaurants/index" options={{ title: 'Lugares' }} />
      <Tabs.Screen name="dishes/index" options={{ title: 'Platos' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
