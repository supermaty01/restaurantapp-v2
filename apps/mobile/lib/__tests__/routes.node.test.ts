import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from '../../components/__support__/glob';

/**
 * Every route the code navigates to must exist.
 *
 * expo-router takes routes as plain strings, so nothing checks them: renaming a
 * screen leaves every `router.push` pointing at it compiling happily and
 * failing at runtime with "página no encontrada". That is exactly how the app
 * shipped opening on the not-found screen — `app/index.tsx` still redirected to
 * `/restaurants` after that route became a segment of Diario.
 *
 * Verified to catch it: pointing any push at a route that does not exist fails
 * this test.
 */

// This file must live OUTSIDE app/: expo-router bundles everything under that
// directory as a route via require.context, so a node test there ends up in the
// app and fails to resolve `node:fs` at runtime.
const ROOT = join(__dirname, '..', '..');
const APP_DIR = join(ROOT, 'app');
const SRC_DIRS = [APP_DIR, join(ROOT, 'components'), join(ROOT, 'features')];

/** `app/(main)/settings/index.tsx` → `/(main)/settings` */
function routeFromFile(path: string): string {
  const relative = path
    .slice(APP_DIR.length)
    .replace(/\\/g, '/')
    .replace(/\.tsx?$/, '');
  return relative.replace(/\/index$/, '') || '/';
}

/**
 * Groups are transparent in the URL and dynamic segments match anything, so
 * `/(main)/visits/[id]/view` and `/visits/123/view` are the same route.
 */
function canonical(route: string): string {
  return (
    route
      // `(main)`, `(tabs)` — organisational only.
      .replace(/\/\([^)]+\)/g, '')
      // `[id]`, `${visit.id}`, a literal number — all one wildcard.
      .replace(/\[[^\]]+\]/g, '*')
      .replace(/\$\{[^}]+\}/g, '*')
      .replace(/\/\d+(?=\/|$)/g, '/*')
      .replace(/\/+$/, '') || '/'
  );
}

const routeFiles = globSync(APP_DIR, /\.tsx$/).filter(
  (file) => !/_layout|\.test\.|__support__/.test(file),
);

const knownRoutes = new Set(routeFiles.map((file) => canonical(routeFromFile(file))));

/** Literal route strings the app navigates to. */
function collectTargets(): { route: string; file: string }[] {
  const found: { route: string; file: string }[] = [];

  const patterns = [
    // router.push('/x'), .replace(`/x/${id}`), href="/x"
    /(?:router\.(?:push|replace|navigate)|href=)\(?\{?\s*[`'"](\/[^`'"]*)[`'"]/g,
    // router.push({ pathname: '/x' })
    /pathname:\s*[`'"](\/[^`'"]*)[`'"]/g,
    // A prop holding a route, e.g. path="/(main)/restaurants/new"
    /(?:path|route)=[{]?[`'"](\/\([^`'"]*)[`'"]/g,
  ];

  for (const dir of SRC_DIRS) {
    for (const file of globSync(dir, /\.tsx$/)) {
      if (/\.test\./.test(file)) continue;
      const source = readFileSync(file, 'utf8');
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
          const route = (match[1] as string).split('?')[0] as string;
          found.push({ route, file });
        }
      }
    }
  }

  return found;
}

describe('navigation targets', () => {
  const targets = collectTargets();

  it('finds the routes to check', () => {
    // A guard on the guard: a broken regex would make this suite pass while
    // checking nothing.
    expect(targets.length).toBeGreaterThan(10);
    expect(knownRoutes.size).toBeGreaterThan(10);
  });

  it.each([...new Set(targets.map((t) => t.route))].sort())('%s exists', (route) => {
    const target = canonical(route);
    // "/" is the entry redirect itself.
    if (target === '/') return;

    const files = targets
      .filter((t) => t.route === route)
      .map((t) => t.file.split(/[\\/]/).slice(-2).join('/'));

    expect({ route, usedIn: [...new Set(files)], resolvesTo: target }).toEqual({
      route,
      usedIn: [...new Set(files)],
      resolvesTo: [...knownRoutes].find((known) => known === target) ?? target,
    });
    expect(knownRoutes.has(target)).toBe(true);
  });
});
