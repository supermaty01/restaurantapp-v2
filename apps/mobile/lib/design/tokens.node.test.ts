import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastRatio, parseHex } from './colour';
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

/**
 * Que la paleta se pueda leer, y que siga pudiéndose la próxima vez.
 *
 * Esto existe porque cambiar la paleta entera —de la terracota sobre crema a la
 * del logo— destapó una trampa que no da ningún error: al aclarar el `primary`
 * del modo oscuro lo suficiente para que sirva de texto sobre el lienzo, el
 * blanco encima deja de leerse. Las dos condiciones tiran en direcciones
 * opuestas y solo se puede saber midiendo, así que se mide.
 *
 * **El umbral es 4:1 y no el 4,5:1 de la norma AA**, a propósito: es el que
 * cumplía la paleta anterior, que se usó durante meses sin queja. Poner 4,5
 * aquí sería escribir una aspiración y verla fallar el primer día; poner el
 * listón donde de verdad está convierte esto en un guardián que se respeta.
 */
describe('la paleta se puede leer', () => {
  const ratio = (a: string, b: string) => {
    const first = parseHex(a);
    const second = parseHex(b);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    return contrastRatio(first!, second!);
  };

  /** Parejas donde uno de los dos es texto o un icono sobre el otro. */
  const TEXT_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
    ['ink', 'canvas'],
    ['ink', 'surface'],
    ['inkMuted', 'surface'],
    ['onPrimary', 'primary'],
    ['onPrimary', 'primaryPressed'],
    ['onInverse', 'inverse'],
    // `tone="primary"`, `tone="danger"` y `tone="accent"` son texto sobre el
    // lienzo o sobre una tarjeta, no solo relleno de botones.
    ['primary', 'canvas'],
    ['primary', 'surface'],
    ['danger', 'surface'],
  ];

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as [string, ThemeColors][])('%s: todo lo que es texto contrasta', (_name, colors) => {
    for (const [front, back] of TEXT_PAIRS) {
      const value = ratio(colors[front], colors[back]);
      expect({ pair: `${front} sobre ${back}`, value: value >= 4 }).toEqual({
        pair: `${front} sobre ${back}`,
        value: true,
      });
    }
  });

  /**
   * El tercer nivel de tinta va aparte, y con un listón más bajo.
   *
   * `inkSubtle` es lo que pinta un `placeholder`, una etiqueta de campo o un
   * icono apagado: cosas que **acompañan** a un dato y que si gritaran tanto
   * como él dejarían de ser el segundo plano que son. La propia norma lo
   * contempla al eximir el texto deshabilitado.
   *
   * El 3:1 no se eligió como aspiración: la paleta anterior estaba en 3,18 en
   * claro y 3,76 en oscuro, así que es donde el proyecto ya vivía. Lo que sí
   * impide este test es que la próxima paleta lo baje todavía más sin querer.
   */
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as [string, ThemeColors][])('%s: la tinta terciaria se sigue viendo', (_name, colors) => {
    expect(ratio(colors.inkSubtle, colors.surface)).toBeGreaterThan(3);
    expect(ratio(colors.inkSubtle, colors.canvas)).toBeGreaterThan(3);
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as [string, ThemeColors][])('%s: sage escribe etiquetas legibles', (_name, colors) => {
    // Mismo nivel que la tinta terciaria y por el mismo motivo: `sage` pinta
    // pastillas e iconos que acompañan, no titulares. La paleta anterior estaba
    // en 3,04 sobre superficie; esto impide bajar de ahí.
    expect(ratio(colors.sage, colors.surface)).toBeGreaterThan(3);
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as [string, ThemeColors][])('%s: primary y sage no se confunden', (_name, colors) => {
    // Comparten familia de tono a propósito (ver `tokens.ts`), así que lo que
    // los separa es la luminosidad. Si se acercaran, una pastilla de «correcto»
    // y un botón de acción pasarían a ser el mismo color.
    expect(ratio(colors.primary, colors.sage)).toBeGreaterThan(1.2);
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as [string, ThemeColors][])('%s: las superficies se distinguen del lienzo', (_name, colors) => {
    // No es contraste de texto: es que una tarjeta se vea *sobre* el fondo. Un
    // ratio de 1 sería una tarjeta invisible.
    expect(ratio(colors.surface, colors.canvas)).toBeGreaterThan(1.05);
    expect(ratio(colors.sunken, colors.surface)).toBeGreaterThan(1.05);
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
