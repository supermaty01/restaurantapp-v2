import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from '../../components/__support__/glob';
import { ASSISTANT_ENABLED } from '../features';

/**
 * A feature that is off has to be off everywhere.
 *
 * Turning one off is easy to do halfway: the button goes, the screen stays
 * reachable by deep link, or the screen goes and something still navigates to
 * it. This checks the two ends match, so shipping a build without the assistant
 * cannot leave a door open into a screen that talks to a Worker nobody
 * configured.
 */

const APP_DIR = join(__dirname, '..', '..', 'app');

function sourceFiles(): string[] {
  return globSync(APP_DIR, /\.tsx?$/);
}

describe('feature flags', () => {
  it('ships the first release without the assistant', () => {
    // A reminder, not a rule: flipping this is a deliberate act and should
    // come with turning the rest of this file's expectations around.
    expect(ASSISTANT_ENABLED).toBe(false);
  });

  it('has no screen navigating to the assistant', () => {
    const offenders = sourceFiles().filter((file) => {
      if (file.endsWith('assistant.tsx')) return false;
      const source = readFileSync(file, 'utf-8');
      return /router\.(push|replace|navigate)\([^)]*assistant/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('guards the assistant screen itself, not only its entry points', () => {
    const screen = readFileSync(join(APP_DIR, '(main)', 'assistant.tsx'), 'utf-8');
    // expo-router registers every file under app/, so removing the Stack.Screen
    // takes away the title and not the route.
    expect(screen).toMatch(/ASSISTANT_ENABLED/);
    expect(screen).toMatch(/Redirect/);
  });
});
