import { Redirect } from 'expo-router';

/**
 * The app is local-first: there is no login gate. Accounts become an opt-in
 * layer on top (see docs/04-auth.md), never an entry barrier.
 *
 * This pointed at `/restaurants` until the tabs were restructured, which left
 * the app opening on "página no encontrada" — the route had become a segment of
 * Diario rather than a screen. Landing on the tab group instead of a specific
 * route means a future reshuffle cannot break the entry point the same way.
 */
export default function Index() {
  return <Redirect href="/(main)/(tabs)" />;
}
