import { Alert } from 'react-native';

/**
 * Surfaces a failure to the user without losing the cause.
 *
 * Screens used to `catch { Alert.alert('Error', 'No se pudo …') }`, which threw
 * the real error away and made failures impossible to diagnose. This keeps the
 * friendly message in production but appends the underlying cause in dev
 * builds, and always logs it so it shows up in the Metro console.
 */
/** Flattens an error and its `cause` chain, so the root reason is never lost. */
function describe(error: unknown, depth = 0): string {
  if (depth > 4) return '…';
  if (!(error instanceof Error)) {
    return typeof error === 'string' ? error : String(error);
  }
  const cause = (error as { cause?: unknown }).cause;
  return cause === undefined ? error.message : `${error.message}\n↳ ${describe(cause, depth + 1)}`;
}

export function reportError(userMessage: string, error: unknown, title = 'Error'): void {
  const detail = describe(error);

  console.error(`${userMessage}:`, error);

  Alert.alert(title, __DEV__ && detail ? `${userMessage}\n\n[dev] ${detail}` : userMessage);
}
