/**
 * Colour maths for user-chosen colours.
 *
 * Tags carry a colour the user picked, which the app has no control over: the
 * default palette alone runs from `#FF9999` to `#FFFF99`. The Clay tag style
 * renders a colour as text on a wash of itself, and many of those are unreadable
 * that way — so the text colour is adjusted until it actually contrasts with
 * what it sits on, keeping the hue the user chose recognisable.
 */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses `#rgb` or `#rrggbb`. Returns null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const value = hex.replace(/^#/, '');

  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function toRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const grey = Math.round(l * 255);
    return { r: grey, g: grey, b: grey };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for normal text. */
const TARGET_CONTRAST = 4.5;

/**
 * Adjusts a colour until it reads as text on `background`, keeping its hue.
 *
 * Lightness is walked away from the background — down on a light surface, up on
 * a dark one — because which direction helps depends on the theme: darkening a
 * tag's colour is right on paper and makes it vanish on a dark pill.
 *
 * The walk is over actual luminance rather than HSL lightness. Those are not
 * the same thing, and assuming they were is what made yellow fail: `#FFFF99`
 * darkened to 38% lightness is still a luminous `#C2C200`, about 1.9:1 against
 * white, nowhere near legible.
 *
 * A colour that already contrasts enough is returned untouched, so a deliberate
 * deep red stays exactly that.
 */
export function readableInk(color: string, background = '#FFFFFF'): string {
  const rgb = parseHex(color);
  const bg = parseHex(background);
  if (!rgb || !bg) return color;

  if (contrastRatio(rgb, bg) >= TARGET_CONTRAST) return color;

  const hsl = toHsl(rgb);
  // Below 50% luminance the background is dark, so the text has to get lighter.
  const goDarker = luminance(bg) > 0.18;

  let best = rgb;
  let bestContrast = contrastRatio(rgb, bg);

  for (let step = 1; step <= 20; step += 1) {
    const l = goDarker ? hsl.l - step * 0.05 : hsl.l + step * 0.05;
    if (l < 0 || l > 1) break;

    const candidate = toRgb({ ...hsl, l });
    const ratio = contrastRatio(candidate, bg);
    if (ratio > bestContrast) {
      best = candidate;
      bestContrast = ratio;
    }
    if (ratio >= TARGET_CONTRAST) return toHex(candidate);
  }

  // Some hues cannot reach AA at any lightness while staying themselves
  // (saturated yellow on white). Take the most legible version we found.
  return toHex(best);
}

/** `#RRGGBB` + opacity → `#RRGGBBAA`, for tinted backgrounds. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;

  const clamped = Math.min(Math.max(alpha, 0), 1);
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');

  return `${toHex(rgb)}${channel}`;
}
