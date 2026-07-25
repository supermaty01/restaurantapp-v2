import { join } from 'node:path';

import { globSync } from '../../components/__support__/glob';

/**
 * `app/` may contain nothing but routes.
 *
 * expo-router pulls in **every** file under that directory with
 * `require.context`, so anything that is not a screen gets bundled into the
 * app. A node test placed there took the whole bundle down with "Unable to
 * resolve module node:fs" — it compiled, it passed under Jest, and it broke the
 * app at startup, which is the worst combination.
 *
 * Helpers and tests belong outside; this file lives in lib/ for that reason.
 */
const APP_DIR = join(__dirname, '..', '..', 'app');

describe('app directory', () => {
  const files = globSync(APP_DIR, /\.(ts|tsx)$/).map((file) =>
    file.slice(APP_DIR.length + 1).replace(/\\/g, '/'),
  );

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('holds no test files', () => {
    expect(files.filter((file) => /\.test\.|\.spec\./.test(file))).toEqual([]);
  });

  it('holds no bare .ts modules — every route is a component', () => {
    // A `.ts` under app/ is by definition not a screen, so it is either a
    // helper that belongs elsewhere or a route that will never render.
    expect(files.filter((file) => file.endsWith('.ts'))).toEqual([]);
  });
});
