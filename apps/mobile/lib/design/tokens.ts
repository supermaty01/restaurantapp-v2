/**
 * La paleta «Huerta» — el único sitio donde vive el color de la app.
 *
 * Sale del logo (`assets/burger-logo.png`), no de un mockup: la cáscara de pan
 * tostado (#98683E), la carne (#A05F3F), la lechuga (#8EB66F), el trazo cacao
 * (#3B1C08) y el fondo verde pálido del icono (#DFE2CF). Un diario de comidas
 * ya tiene todo el color que una pantalla aguanta en las fotos, así que la
 * interfaz se aparta: papel con un punto de verde, un solo acento, y saturación
 * solo donde la pone el usuario.
 *
 * **Por qué se cambió.** La anterior era terracota (#C0623D) sobre crema
 * (#F7F1E8), que es casi exactamente la paleta de Claude Code — el mismo tono
 * coral sobre el mismo papel. Los dos rasgos que lo delataban eran el lienzo
 * crema y el acento coral, así que se movieron los dos: el lienzo a un papel
 * teñido de salvia y el acento del coral (~18°) al caramelo de la corteza
 * (~30°). El parecido desaparece sin que la app deje de ser cálida.
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
  canvas: '#F2F4EA',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFCF3',
  sunken: '#E6EAD9',
  line: '#E4E9D7',
  lineStrong: '#D3D9C2',
  ink: '#2F1D0C',
  inkMuted: '#6A5A47',
  inkSubtle: '#9A8D78',
  primary: '#8A5A2B',
  primaryPressed: '#6E461F',
  onPrimary: '#FFFFFF',
  accent: '#A97A25',
  sage: '#5F7F3D',
  danger: '#A8402F',
  inverse: '#2F1D0C',
  onInverse: '#F2F4EA',
};

export const darkColors: ThemeColors = {
  canvas: '#1B1711',
  surface: '#272219',
  surfaceAlt: '#272219',
  sunken: '#141109',
  line: '#3A3327',
  lineStrong: '#4B4335',
  ink: '#F0EEDF',
  inkMuted: '#B3A992',
  inkSubtle: '#8C8371',
  // Más claro que en modo claro, no el mismo tono: un caramelo oscuro sobre un
  // fondo oscuro no es un acento, es una mancha.
  primary: '#C99155',
  // Aclarar y no oscurecer al pulsar: sobre fondo oscuro, más oscuro se lee
  // como "desactivado".
  primaryPressed: '#DCA972',
  // Y por eso el texto de encima es tinta, no blanco: blanco sobre este
  // caramelo da 2,7:1 y no se lee.
  onPrimary: '#241703',
  accent: '#DDAF57',
  sage: '#8EB66F',
  danger: '#E0705A',
  inverse: '#F2F4EA',
  onInverse: '#2F1D0C',
};

/**
 * Warm gradients used as placeholders where a photo is missing, so an empty
 * card still looks deliberate. Indexed by a stable hash of the entity name, so
 * the same restaurant always gets the same colours.
 */
export const placeholderGradients: readonly (readonly [string, string])[] = [
  ['#C29868', '#98683E'],
  ['#D3B487', '#A9834B'],
  ['#A05F3F', '#6F3C25'],
  ['#8EB66F', '#5F7F3D'],
  ['#B7C79A', '#7C8F5C'],
  ['#C9A87C', '#8A5A2B'],
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

/**
 * Las dos familias.
 *
 * Antes eran Newsreader + Plus Jakarta Sans, una pareja correcta y anónima:
 * una serif de periódico y una geométrica que se ve en media web. Fraunces
 * tiene el mismo trabajo editorial pero con carácter —terminaciones suaves,
 * contraste alto, algo de brillo de rótulo de bar— y Manrope da a lo que se lee
 * de corrido una humanidad que la anterior no tenía.
 *
 * Las dos siguen siendo paquetes de solo assets (`@expo-google-fonts/*`), sin
 * código nativo, así que no añaden riesgo en las actualizaciones de Expo — la
 * preocupación central de docs/11.
 */
export const fonts = {
  /** Fraunces — titulares, cifras, lo que se mira antes de leerse. */
  display: 'Fraunces_500Medium',
  displaySemi: 'Fraunces_600SemiBold',
  /** Manrope — todo lo que se lee de corrido. */
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
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
    shadowColor: '#2F1D0C',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** Raised surfaces: the tab bar, sticky headers. */
  medium: {
    shadowColor: '#2F1D0C',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /** Sheets, dialogs, anything overlaying the page. */
  high: {
    shadowColor: '#2F1D0C',
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
