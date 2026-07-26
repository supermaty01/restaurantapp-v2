/**
 * What this build ships.
 *
 * A flag rather than deleted code: the assistant is finished enough to compile
 * and tested, it simply is not going out in the first release. Ripping it out
 * to ship, then pasting it back, is how working code turns into broken code —
 * and a branch that diverges from what is actually installed on the phone.
 *
 * These are constants, not settings. Nothing at runtime can turn a feature on:
 * an off feature has no screen to reach, no route registered and no button, so
 * there is nothing for a stale link or a curious tap to land on.
 */

/**
 * The AI assistant (docs/07).
 *
 * Off for the first release. It needs a Worker with AI Gateway configured, and
 * a first deploy has enough moving parts — a diary that syncs, shares and
 * survives an upgrade from v1 — without adding one whose failures are hard to
 * tell apart from a slow network.
 */
export const ASSISTANT_ENABLED = false;
