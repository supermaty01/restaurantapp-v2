import { Tabs } from 'expo-router';
import { useState } from 'react';

import { CreateSheet } from '@/components/ui/CreateSheet';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

/**
 * Bottom tabs (docs/08, docs/14).
 *
 * **Inicio · Diario · ➕ · Feed · Perfil.**
 *
 * The previous layout had Lugares and Platos as peer tabs with Visitas exiled
 * to a menu row, even though all three are the same machinery over the same
 * diary — and before that Etiquetas had been a tab, which gave a *filtering
 * dimension* the same weight as the collections it filters. Diario now holds
 * all three behind a segmented control, and tags went back to being a filter.
 *
 * The ➕ is an action, not a destination, so it is not a route: it opens a
 * sheet from here. That replaces one FAB per list plus the home quick actions —
 * "add something" no longer starts with deciding where to be first.
 *
 * Screens leave room for the floating bar with `tabBar` on `Screen`, or `pb-28`.
 */
export default function TabsLayout() {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} onCreate={() => setCreating(true)} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="journal" options={{ title: 'Diario' }} />
        <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
        <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      </Tabs>

      <CreateSheet visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}
