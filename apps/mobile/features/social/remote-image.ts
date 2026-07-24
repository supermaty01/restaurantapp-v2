/**
 * Builds the URL for a photo belonging to someone else.
 *
 * A friend's images are not on this device, so they are served by the Worker
 * (`GET /images/:userId/:key`, docs/05). Returns null when the API is not
 * configured, which is the normal state of a purely local install — callers
 * fall back to the placeholder rather than requesting a broken URL.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function remoteImageUri(userId: string, imageKey: string | null): string | undefined {
  if (!API_URL || !imageKey) return undefined;
  return `${API_URL.replace(/\/$/, '')}/images/${encodeURIComponent(userId)}/${encodeURIComponent(
    imageKey,
  )}`;
}
