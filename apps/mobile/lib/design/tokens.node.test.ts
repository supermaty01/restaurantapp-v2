import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { darkColors, gradientFor, lightColors, placeholderGradients } from './tokens';

import type { ThemeColors } from './tokens';

/**
 * The palette is declared twice by necessity: as TypeScript (for props that
 * take a colour string) and as CSS variables (for NativeWind classes). Nothing
 * at runtime notices when the two disagree — the app just renders half-themed,
 * which is exactly the kind of bug that reaches a device. So the agreement is
 * asserted here instead.
 */

const css = readFileSync(join(__dirname, '..', '..', 'global.css'), 'utf8');

/** `--color-ink-muted: 107 99 85;` → `#6B6355` */
function cssVarsToHex(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [, name, channels] of block.matchAll(/--color-([a-z-]+):\s*([\d\s]+);/g)) {
    const hex = (channels as string)
      .trim()
      .split(/\s+/)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('');
    result[name as string] = `#${hex.toUpperCase()}`;
  }
  return result;
}

/** `inkMuted` → `ink-muted` */
function kebab(name: string): string {
  return name.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();
}

function blockFor(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return cssVarsToHex(css.slice(open, close));
}

describe('theme tokens', () => {
  const cases: [string, string, ThemeColors][] = [
    ['light', ':root {', lightColors],
    ['dark', '.dark:root {', darkColors],
  ];

  it.each(cases)('%s CSS variables match tokens.ts', (_name, selector, colors) => {
    const declared = blockFor(selector);

    for (const [key, hex] of Object.entries(colors)) {
      expect(declared[kebab(key)]).toBe(hex.toUpperCase());
    }
  });

  it.each(cases)('%s declares no variable that tokens.ts lacks', (_name, selector, colors) => {
    const expected = Object.keys(colors).map(kebab).sort();
    expect(Object.keys(blockFor(selector)).sort()).toEqual(expected);
  });

  it('both schemes define the same set of colours', () => {
    // A key present in only one scheme renders as a missing variable, i.e.
    // transparent, in the other.
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});

describe('gradientFor', () => {
  it('is stable for the same name', () => {
    expect(gradientFor('Trattoria Bella')).toBe(gradientFor('Trattoria Bella'));
  });

  it('spreads different names across the palette', () => {
    const names = ['Trattoria Bella', 'Sakura Ramen', 'Guadalupe', 'La Tagliatella', 'Chihuahua'];
    expect(new Set(names.map((n) => gradientFor(n)[0])).size).toBeGreaterThan(1);
  });

  it('always returns a real gradient, including for an empty name', () => {
    expect(placeholderGradients).toContain(gradientFor(''));
  });
});
