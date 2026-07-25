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
    if (typeof error === 'string') return error;
    // `String(obj)` gives "[object Object]", which is the least useful string
    // in computing: it appeared verbatim in a user-facing dialog.
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch {
        return Object.prototype.toString.call(error);
      }
    }
    return String(error);
  }
  const cause = (error as { cause?: unknown }).cause;
  return cause === undefined ? error.message : `${error.message}\n↳ ${describe(cause, depth + 1)}`;
}

/**
 * How failures reach the screen.
 *
 * `reportError` is called from plain functions and catch blocks, not from
 * components, so it cannot use a hook to reach the themed dialog. The provider
 * registers itself here at mount instead; until it does — or if it is ever
 * unmounted — this falls back to the platform `Alert`, because an error that
 * cannot be shown is worse than one shown in the wrong font.
 */
type Presenter = (title: string, message: string) => void;

const nativeAlert: Presenter = (title, message) => Alert.alert(title, message);

let present: Presenter = nativeAlert;

export function setErrorPresenter(presenter: Presenter | null): void {
  present = presenter ?? nativeAlert;
}

export function reportError(userMessage: string, error: unknown, title = 'Error'): void {
  const detail = describe(error);

  console.error(`${userMessage}:`, error);

  // Skip the dev block when it would just repeat the message: some callers
  // pass the error's own text because it is already written for a person.
  const adds = Boolean(detail) && detail !== userMessage && !detail.startsWith(userMessage);
  present(
    title,
    __DEV__ && adds
      ? `${userMessage}

[dev] ${detail}`
      : userMessage,
  );
}
