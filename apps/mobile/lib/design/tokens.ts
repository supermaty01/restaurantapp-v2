/**
 * The Clay palette — the single source of truth for colour in the app.
 *
 * Taken from the "RestaurantApp Refresh" design project (docs/14). Warm clay
 * and paper tones, terracotta as the one accent, amber for ratings, sage for
 * category chips.
 *
 * Two consumers, and they must not drift:
 *
 * - **Styles** read these through NativeWind (`bg-surface`, `text-ink`). The
 *   values live in `global.css` as CSS variables so a single class works in
 *   both schemes — no `dark:` twin on every element.
 * - **Props** read them from here, for the APIs that take a plain colour
 *   string: icon `color`, `StatusBar`, map styling, `ActivityIndicator`.
 *
 * `tokens.test.ts` asserts the CSS variables match this file, so editing one
 * without the other fails the build rather than shipping a half-themed screen.
 */

export interface ThemeColors {
  /** App background, behind everything. */
  canvas: string;
  /** Cards, inputs, sheets. */
  surface: string;
  /** Slightly lifted surface: tab bar, headers. */
  surfaceAlt: string;
  /** Recessed surface: track backgrounds, disabled fields. */
  sunken: string;
  /** Default hairline. */
  line: string;
  /** Heavier divider, dashed drop zones. */
  lineStrong: string;
  /** Primary text. */
  ink: string;
  /** Secondary text: descriptions, metadata. */
  inkMuted: string;
  /** Tertiary text: labels, placeholders, inactive icons. */
  inkSubtle: string;
  /** The single accent: actions, links, active tab. */
  primary: string;
  /** Pressed/active state for primary. */
  primaryPressed: string;
  /** Text and icons on top of `primary`. */
  onPrimary: string;
  /** Ratings and stars. */
  accent: string;
  /** Category chips, positive states. */
  sage: string;
  /** Destructive actions. */
  danger: string;
  /** Inverted block (the dark stat tile on a light screen). */
  inverse: string;
  /** Text on `inverse`. */
  onInverse: string;
}

export const lightColors: ThemeColors = {
  canvas: '#F7F1E8',
  surface: '#FFFFFF',
  surfaceAlt: '#FFFDF8',
  sunken: '#EFE7D8',
  line: '#EFE7D8',
  lineStrong: '#E6DDCE',
  ink: '#2A211C',
  inkMuted: '#6B6355',
  inkSubtle: '#9A8F7D',
  primary: '#C0623D',
  primaryPressed: '#A44F2F',
  onPrimary: '#FFFFFF',
  accent: '#E0A83B',
  sage: '#8A9A6B',
  danger: '#B04A3A',
  inverse: '#2A211C',
  onInverse: '#F7F1E8',
};

export const darkColors: ThemeColors = {
  canvas: '#211C18',
  surface: '#2C2621',
  surfaceAlt: '#2C2621',
  sunken: '#1A1512',
  line: '#3A332C',
  lineStrong: '#4A4139',
  ink: '#F0E9DD',
  inkMuted: '#B0A48F',
  inkSubtle: '#8A7E6F',
  primary: '#C0623D',
  // Lighter than the base on dark, where a darker press reads as "disabled".
  primaryPressed: '#D9784F',
  onPrimary: '#FFFFFF',
  accent: '#E0A83B',
  sage: '#8A9A6B',
  danger: '#D05A48',
  inverse: '#F7F1E8',
  onInverse: '#2A211C',
};

/**
 * Warm gradients used as placeholders where a photo is missing, so an empty
 * card still looks deliberate. Indexed by a stable hash of the entity name, so
 * the same restaurant always gets the same colours.
 */
export const placeholderGradients: readonly (readonly [string, string])[] = [
  ['#D9A066', '#B5622F'],
  ['#E6C67E', '#C98A3C'],
  ['#C0623D', '#8A3F26'],
  ['#A8B489', '#6E7F52'],
  ['#E0A83B', '#B57F22'],
  ['#D8B7A6', '#B07C63'],
];

/** Picks a stable gradient for a name, so a card never changes colour. */
export function gradientFor(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % placeholderGradients.length;
  return placeholderGradients[index] as readonly [string, string];
}

export const radius = {
  sm: 9,
  md: 11,
  lg: 13,
  xl: 16,
  pill: 100,
} as const;

export const fonts = {
  /** Newsreader — headings, numbers, anything that should feel editorial. */
  display: 'Newsreader_500Medium',
  displaySemi: 'Newsreader_600SemiBold',
  /** Plus Jakarta Sans — everything else. */
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;
