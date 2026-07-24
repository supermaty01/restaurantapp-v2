/**
 * Canonical v4 uuid — the global sync identity for a row (docs/02).
 *
 * Uses `expo-crypto`, which ships inside Expo Go: the previous implementation
 * relied on `uuid` + `react-native-get-random-values`, a third-party native
 * module absent from Expo Go, which crashed the app on launch. Node (tests)
 * has `crypto.randomUUID` natively, so expo-crypto is only loaded on device —
 * keeping it out of the node test bundle, which can't parse its ESM build.
 */
export function newUuid(): string {
  const nativeCrypto = globalThis.crypto;
  if (typeof nativeCrypto?.randomUUID === 'function') {
    return nativeCrypto.randomUUID();
  }

  // React Native: no global crypto, so use the Expo module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require('expo-crypto') as { randomUUID: () => string };
  return Crypto.randomUUID();
}
