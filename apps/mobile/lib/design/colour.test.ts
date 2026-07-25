import {
  TAG_HUES,
  contrastRatio,
  neutralShades,
  onColor,
  parseHex,
  readableInk,
  shadesOf,
  withAlpha,
} from './colour';
import { darkColors, lightColors } from './tokens';

function contrast(a: string, b: string): number {
  return contrastRatio(parseHex(a)!, parseHex(b)!);
}

describe('parseHex', () => {
  it('reads long and short form', () => {
    expect(parseHex('#C0623D')).toEqual({ r: 192, g: 98, b: 61 });
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('C0623D')).toEqual({ r: 192, g: 98, b: 61 });
  });

  it('rejects anything that is not a colour', () => {
    expect(parseHex('rebeccapurple')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('readableInk', () => {
  // The colours the tag picker actually offers — the pale end is the whole
  // reason this function exists.
  const paleTagColours = ['#FFFF99', '#FFDAB9', '#FFD700', '#FFCC99', '#FFB6C1', '#FF9999'];

  it.each(paleTagColours)('makes %s legible on the light surface', (colour) => {
    expect(contrast(readableInk(colour, lightColors.surface), lightColors.surface)).toBeGreaterThan(
      4.5,
    );
  });

  // The other half of the problem: darkening a tag is right on paper and makes
  // it disappear on a dark pill.
  it.each(paleTagColours.concat(['#2A211C', '#8A3F26']))(
    'makes %s legible on the dark surface too',
    (colour) => {
      expect(contrast(readableInk(colour, darkColors.surface), darkColors.surface)).toBeGreaterThan(
        4.5,
      );
    },
  );

  it('leaves a colour that already contrasts enough untouched', () => {
    expect(readableInk('#2A211C', lightColors.surface)).toBe('#2A211C');
    expect(readableInk('#8A3F26', lightColors.surface)).toBe('#8A3F26');
  });

  it('keeps the hue, so the tag still looks like the colour it was given', () => {
    // A pale red must move to a red, not to a neutral brown.
    const ink = parseHex(readableInk('#FF9999', lightColors.surface));
    expect(ink).not.toBeNull();
    expect(ink!.r).toBeGreaterThan(ink!.g);
    expect(ink!.r).toBeGreaterThan(ink!.b);
  });

  it('handles pure white and black without dividing by zero', () => {
    expect(contrast(readableInk('#FFFFFF', '#FFFFFF'), '#FFFFFF')).toBeGreaterThan(4.5);
    expect(contrast(readableInk('#000000', '#211C18'), '#211C18')).toBeGreaterThan(4.5);
  });

  it('passes through an unparseable value rather than throwing', () => {
    expect(readableInk('transparent')).toBe('transparent');
  });
});

describe('withAlpha', () => {
  it('appends the alpha channel', () => {
    expect(withAlpha('#C0623D', 0.16)).toBe('#c0623d29');
    expect(withAlpha('#C0623D', 1)).toBe('#c0623dff');
    expect(withAlpha('#C0623D', 0)).toBe('#c0623d00');
  });

  it('clamps out-of-range opacity', () => {
    expect(withAlpha('#C0623D', 5)).toBe('#c0623dff');
    expect(withAlpha('#C0623D', -1)).toBe('#c0623d00');
  });

  it('expands short form', () => {
    expect(withAlpha('#fff', 0.5)).toBe('#ffffff80');
  });
});

describe('onColor', () => {
  it('picks ink on pale colours and white on deep ones', () => {
    expect(onColor('#FFFF99')).toBe('#2A211C');
    expect(onColor('#FFD700')).toBe('#2A211C');
    expect(onColor('#8A3F26')).toBe('#FFFFFF');
    expect(onColor('#2A211C')).toBe('#FFFFFF');
  });

  it.each(['#FFFF99', '#FFDAB9', '#FF9999', '#8A9A6B', '#C0623D', '#8A3F26'])(
    'is legible on %s',
    (colour) => {
      expect(contrast(onColor(colour), colour)).toBeGreaterThan(4);
    },
  );

  it('falls back to white for an unparseable colour', () => {
    expect(onColor('rebeccapurple')).toBe('#FFFFFF');
  });
});

describe('tag palette', () => {
  it('offers a usable number of colours', () => {
    const all = TAG_HUES.flatMap((hue) => shadesOf(hue));
    expect(all).toHaveLength(TAG_HUES.length * 5);
    // No duplicates: two swatches that produce the same colour are one swatch
    // and one dead tap.
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(TAG_HUES)('every shade of hue %s is legible on both surfaces', (hue) => {
    for (const shade of shadesOf(hue)) {
      expect(
        contrast(readableInk(shade, lightColors.surface), lightColors.surface),
      ).toBeGreaterThan(4.5);
      expect(contrast(readableInk(shade, darkColors.surface), darkColors.surface)).toBeGreaterThan(
        4.5,
      );
    }
  });

  it('keeps a filled chip legible at every shade', () => {
    for (const hue of TAG_HUES) {
      for (const shade of shadesOf(hue)) {
        expect(contrast(onColor(shade), shade)).toBeGreaterThan(4);
      }
    }
  });

  it('produces neutrals that are actually neutral', () => {
    for (const grey of neutralShades()) {
      const rgb = parseHex(grey);
      expect(rgb).not.toBeNull();
      // Warm, but only just: the spread between channels stays small.
      expect(Math.max(rgb!.r, rgb!.g, rgb!.b) - Math.min(rgb!.r, rgb!.g, rgb!.b)).toBeLessThan(40);
    }
  });
});
