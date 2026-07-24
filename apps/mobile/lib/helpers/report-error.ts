import { Alert } from 'react-native';

/**
 * Surfaces a failure to the user without losing the cause.
 *
 * Screens used to `catch { Alert.alert('Error', 'No se pudo …') }`, which threw
 * the real error away and made failures impossible to diagnose. This keeps the
 * friendly message in production but appends the underlying cause in dev
 * builds, and always logs it so it shows up in the Metro console.
 */
export function reportError(userMessage: string, error: unknown, title = 'Error'): void {
  const cause =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  console.error(`${userMessage}:`, error);

  Alert.alert(title, __DEV__ && cause ? `${userMessage}\n\n[dev] ${cause}` : userMessage);
}
