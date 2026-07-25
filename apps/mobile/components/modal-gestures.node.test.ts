import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from './__support__/glob';

/**
 * Every `Modal` that uses gestures must wrap its content in a
 * `GestureHandlerRootView`.
 *
 * React Native's `Modal` renders into its own native view hierarchy, outside
 * the root view that gesture-handler attaches to, so gestures declared inside
 * one are **silently inert** — no error, no warning, they just never fire. The
 * image lightbox shipped like this: pinch, double-tap and drag-to-dismiss all
 * did nothing on device, while the close button and the paging FlatList kept
 * working (a plain Pressable and a native scroll view), which made it look like
 * a zoom bug rather than a dead gesture root.
 *
 * Nothing at runtime or in the type system catches this, and a rendering test
 * would need half the Expo native stack mocked to prove a native-hierarchy
 * detail. Checking the source is what actually guards it.
 */

const GESTURE_USE = /<GestureDetector|Gesture\.[A-Z]|PanGestureHandler|Swipeable/;

describe('gestures inside a Modal', () => {
  const files = globSync(join(__dirname, '..'), /\.tsx$/);

  const modalsWithGestures = files
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => source.includes('<Modal') && GESTURE_USE.test(source));

  it('finds the modals to check', () => {
    // A guard on the guard: if this ever drops to zero the suite would pass
    // while testing nothing.
    expect(modalsWithGestures.length).toBeGreaterThan(0);
  });

  it.each(modalsWithGestures.map(({ path }) => path))(
    '%s wraps its modal content in a GestureHandlerRootView',
    (path) => {
      // The opening tag specifically: a substring check passes on an import
      // alone, and even on a typo'd `<GestureHandlerRootViewX>`.
      expect(readFileSync(path, 'utf8')).toMatch(/<GestureHandlerRootView[\s>]/);
    },
  );
});
