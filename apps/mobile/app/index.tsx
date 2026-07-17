import { Redirect } from 'expo-router';

/**
 * The app is local-first: there is no login gate. Accounts become an opt-in
 * layer on top (see docs/04-auth.md), never an entry barrier.
 */
export default function Index() {
  return <Redirect href="/restaurants" />;
}
