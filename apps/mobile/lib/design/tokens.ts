/**
 * La paleta de la app — la única fuente de verdad del color.
 *
 * ## De dónde sale, y por qué se cambió
 *
 * La anterior («Clay», docs/14) era terracota `#C0623D` sobre crema `#F7F1E8`:
 * casi exactamente la de Claude Code, el mismo coral sobre el mismo papel. No
 * era una casualidad —los dos salen de la misma moda— pero una app propia no
 * puede parecer la herramienta con la que se escribió.
 *
 * Los dos rasgos que lo delataban son **el lienzo y el acento**, así que se
 * mueven los dos, y todo lo nuevo sale del logo:
 *
 * | Del logo            | Rol         | Por qué                                        |
 * | ------------------- | ----------- | ---------------------------------------------- |
 * | trazo cacao         | `ink`       | Es el color con el que está dibujado todo       |
 * | lechuga             | `primary`   | El único tono saturado del icono                |
 * | corteza del pan     | `accent`    | Cálido, para las estrellas                      |
 * | carne               | `danger`    | Rojo ladrillo, ya presente                      |
 * | fondo verde pálido  | `canvas`    | Aclarado hasta ser papel, no bloque de color    |
 *
 * **`primary` y `sage` comparten familia de tono a propósito.** Es lo que peor
 * queda de esta paleta y se decidió con las dos opciones delante: el logo solo
 * tiene un tono saturado, así que o el color de acción es verde —y entonces el
 * verde de «correcto» es un pariente suyo— o hay que inventarse un color que no
 * está en el logo. Lo que los separa no es el tono sino la forma: `primary`
 * rellena botones, `sage` tiñe pastillas y escribe etiquetas. Y en cada esquema
 * `sage` se va al lado desde el que se lee sobre la superficie —por debajo del
 * primario en claro, por encima en oscuro— así que nunca quedan al lado.
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
  canvas: '#F2F2E7',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFAF4',
  sunken: '#E6E8D7',
  line: '#E6E8D7',
  lineStrong: '#D4D8C1',
  ink: '#2E2016',
  inkMuted: '#6B5F4E',
  inkSubtle: '#8E8474',
  primary: '#5F7A43',
  primaryPressed: '#4C6335',
  onPrimary: '#FFFFFF',
  accent: '#C4873C',
  sage: '#6E8C3F',
  danger: '#A8452F',
  inverse: '#2E2016',
  onInverse: '#F2F2E7',
};

export const darkColors: ThemeColors = {
  /*
   * Neutros, no marrones.
   *
   * El primer intento tiñó estos seis hacia el verde del logo, igual que el
   * lienzo del modo claro. En claro funciona —sobre papel casi blanco, una
   * pizca de color se lee como calidez—; en oscuro el mismo gesto convierte
   * cada tarjeta en un bloque **café**, que fue exactamente la queja. Un fondo
   * oscuro tiene mucha más superficie por la que un tinte se acumula.
   *
   * Así que aquí el color lo pone el acento y nada más. Queda un resto de
   * calidez de dos o tres puntos entre canales, lo justo para que no se vea
   * azulado al lado del modo claro.
   */
  canvas: '#1A1A19',
  surface: '#242423',
  surfaceAlt: '#292928',
  sunken: '#131312',
  line: '#313130',
  lineStrong: '#403F3E',
  ink: '#EDEDEB',
  inkMuted: '#A9A9A6',
  inkSubtle: '#807F7C',
  // Mucho más claro que en modo claro, y no es un capricho: en oscuro este
  // color tiene que **leerse como texto** sobre el lienzo (`tone="primary"`), y
  // el verde profundo de arriba no llega. Lighter than the base on dark, where a
  // darker press reads as "disabled".
  primary: '#9BBF6E',
  primaryPressed: '#B0D084',
  /*
   * Tinta, no blanco.
   *
   * Es la consecuencia de lo de arriba y hay que decirla: blanco sobre ese verde
   * claro da 3,1:1, que es ilegible en un botón. Cualquier `#fff` escrito a mano
   * encima de `bg-primary` está mal en modo oscuro — se lee de `colors.onPrimary`,
   * y `tokens.node.test.ts` vigila que la pareja siga contrastando.
   */
  onPrimary: '#1A1A19',
  accent: '#DBA954',
  // Por encima de `primary`, al revés que en claro. La regla no es «siempre más
  // claro» ni «siempre más oscuro»: es **el lado desde el que se lee sobre la
  // superficie de ese esquema**, que en claro cae por debajo del primario y en
  // oscuro por encima. Legibilidad primero; distinguirse del primario, después.
  sage: '#B4D68A',
  danger: '#D06A52',
  inverse: '#F2F2E7',
  onInverse: '#2E2016',
};

/**
 * Warm gradients used as placeholders where a photo is missing, so an empty
 * card still looks deliberate. Indexed by a stable hash of the entity name, so
 * the same restaurant always gets the same colours.
 */
export const placeholderGradients: readonly (readonly [string, string])[] = [
  ['#C7A272', '#96683A'],
  ['#A8C47E', '#6C8A4A'],
  ['#D8B15A', '#A87A28'],
  ['#B98363', '#8A5238'],
  ['#8FA86A', '#5C7340'],
  ['#C99A80', '#9C6650'],
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
 * Las dos tipografías, y por qué estas.
 *
 * Antes eran Newsreader y Plus Jakarta Sans, que es —otra vez— el par que se
 * asocia a las interfaces de Anthropic: una serie de transición discreta para
 * los títulos y una geométrica neutra para el resto. Bien hechas y sin ninguna
 * personalidad propia.
 *
 * **Fraunces** es una serif de contraste alto con formas deliberadamente raras
 * (la «g», la «y», los remates blandos). Es lo contrario de discreta, y encaja
 * con lo que es la app: un cuaderno de comidas, no un panel de control. Se usa
 * solo en títulos y números grandes, que es donde una letra con carácter se
 * disfruta y no molesta.
 *
 * **Manrope** para el texto: geométrica pero de aperturas cerradas y remates
 * cortados, así que aguanta bien los tamaños pequeños de una lista y no compite
 * con la serif.
 */
export const fonts = {
  /** Fraunces — títulos, números, lo que debe sentirse escrito a mano alzada. */
  display: 'Fraunces_500Medium',
  displaySemi: 'Fraunces_600SemiBold',
  /** Manrope — todo lo demás. */
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
