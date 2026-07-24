/**
 * Debug logging that disappears in production builds.
 *
 * These traces were `console.log`; silencing the `no-console` rule by turning
 * them into `console.warn` made routine startup chatter show up as warnings in
 * the user's console. This keeps the traces during development without the
 * false alarm.
 */
export function devLog(scope: string, ...args: unknown[]): void {
  if (__DEV__) {
    console.warn(`[${scope}]`, ...args);
  }
}
