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

/**
 * Soft, warm shadows.
 *
 * The mockups are flat — border-only cards on a warm canvas — which reads clean
 * but slightly inert. A little elevation gives the paper metaphor somewhere to
 * live: cards sit *on* the canvas rather than being drawn onto it.
 *
 * The shadow is tinted with the ink brown rather than pure black, so it warms
 * the surface underneath instead of greying it. Android only honours
 * `elevation` (and paints it neutral), so the two platforms are close but not
 * identical — deliberately, rather than flattening iOS to match.
 */
export const elevation = {
  /** Resting cards and list rows. */
  low: {
    shadowColor: '#2A211C',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** Raised surfaces: the tab bar, sticky headers. */
  medium: {
    shadowColor: '#2A211C',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /** Sheets, dialogs, anything overlaying the page. */
  high: {
    shadowColor: '#2A211C',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/**
 * Type scale.
 *
 * Sizes pair with a line height and a tracking value, because the display face
 * (Newsreader) and the text face (Plus Jakarta Sans) want opposite treatment:
 * the serif wants tight leading and neutral tracking at large sizes, the sans
 * wants open leading and slightly negative tracking at small ones.
 */
export const type = {
  hero: { fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  display: { fontSize: 27, lineHeight: 32, letterSpacing: -0.3 },
  title: { fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21 },
  callout: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12.5, lineHeight: 17 },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
} as const;
