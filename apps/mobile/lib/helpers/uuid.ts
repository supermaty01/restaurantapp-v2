import { v4 as uuidv4 } from 'uuid';

/**
 * Canonical v4 uuid — the global sync identity for a row (docs/02).
 *
 * On React Native, `uuid` needs `react-native-get-random-values` imported once
 * at app entry (done in app/_layout.tsx). Node (tests) has crypto natively.
 */
export function newUuid(): string {
  return uuidv4();
}
