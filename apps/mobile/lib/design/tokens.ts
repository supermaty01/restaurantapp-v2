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

import { contrastRatio, hsl, parseHex } from './colour';

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

// ── Los temas ────────────────────────────────────────────────────────────────

/**
 * Las ocho paletas, y por qué siete de ellas se generan.
 *
 * La verde de arriba salió del logo y está afinada a mano, color a color. Las
 * otras siete **no se escriben a mano**: son diecisiete colores por esquema, dos
 * esquemas, siete paletas — 238 valores hexadecimales. Transcribir 238 valores
 * es 238 oportunidades de que uno quede ilegible sin que nadie lo note, que es
 * exactamente el argumento que la migración 0021 usa para generar políticas
 * desde el catálogo en vez de copiarlas.
 *
 * Así que cada paleta es un puñado de números —un tono, cuánta saturación
 * aguanta ese tono, y a qué luminosidad tiene que ir el color de acción para que
 * se lea— y el resto sale de la estructura de la verde. `tokens.node.test.ts`
 * mide **las ocho**, así que una paleta que no contraste no llega a la pantalla.
 *
 * ## Qué cambia y qué no
 *
 * Cambia el color de acción **y los neutros**, que es la mitad que se olvida: un
 * tema que solo mueve el botón deja la app con el mismo fondo de siempre y un
 * acento pegado encima. El lienzo, las tarjetas, las líneas y la tinta se tiñen
 * hacia el mismo tono; poco, porque la lección del modo oscuro de la ronda 8
 * sigue en pie —en oscuro hay mucha superficie por la que un tinte se acumula, y
 * ahí un 3% ya se ve—.
 *
 * **`danger` no cambia.** Es un rojo en las ocho, incluida la escala de grises,
 * porque no es decoración: es la señal de que algo se borra. Un tema no puede
 * elegir que borrar se vea igual que guardar. La única paleta que lo mueve es la
 * roja, y solo para que no se confunda con su propio color de acción.
 */
export const PALETTE_IDS = [
  'green',
  'orange',
  'blue',
  'pink',
  'purple',
  'yellow',
  'red',
  'grey',
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export interface Palette {
  id: PaletteId;
  /** Lo que se lee en Ajustes. */
  label: string;
  light: ThemeColors;
  dark: ThemeColors;
}

interface PaletteSpec {
  id: PaletteId;
  label: string;
  /** Tono del color de acción, en grados. */
  hue: number;
  /** Cuánta saturación aguanta ese tono sin cansar. El amarillo, menos. */
  saturation: number;
  /**
   * Luminosidad de `primary` en cada esquema, y no un valor único.
   *
   * Es lo que no se puede compartir entre tonos: un azul al 45% se lee sobre
   * blanco y un amarillo al 45% no se lee en absoluto. Y las dos condiciones
   * tiran en direcciones opuestas —en claro tiene que ser texto sobre papel, en
   * oscuro texto sobre el lienzo—, así que son dos números.
   */
  lightL: number;
  darkL: number;
  /** Cuánto se tiñe el lienzo hacia el tono. 0 es gris de verdad. */
  neutralSaturation: number;
  /** El color de las estrellas, en claro. El de oscuro sale de este. */
  accent: readonly [number, number, number];
  /** Solo la paleta roja lo cambia, para no chocar con su propio primario. */
  danger?: { light: string; dark: string };
}

/** El rojo de «esto borra». El mismo en todas salvo donde chocaría. */
const DANGER = { light: '#A8452F', dark: '#D06A52' };

/**
 * `sage`, colocado **por medida** y no por un desplazamiento fijo.
 *
 * El primer intento fue «la luminosidad del primario más ocho», y falló en tres
 * paletas de las ocho sin que se pudiera adivinar en cuáles: subir ocho puntos
 * de luminosidad HSL no sube lo mismo en un naranja que en un morado, porque
 * luminosidad HSL y luminancia no son la misma cosa —es exactamente la trampa
 * que `readableInk` documenta con el amarillo—. Así que aquí no se estima: se
 * aclara de uno en uno hasta que la diferencia con el primario es la que tiene
 * la paleta verde, y se para ahí.
 *
 * Se para ahí y no más allá porque las dos condiciones tiran en direcciones
 * opuestas: separarse del primario quiere más claro, y leerse sobre la tarjeta
 * quiere más oscuro. El margen entero son los 4,8:1 que el primario saca de
 * sobra sobre el papel; gastarlo de más deja a `sage` por debajo de 3:1 y
 * entonces la pastilla no se lee.
 */
const SAGE_SEPARATION = 1.28;

function separatedFromPrimary(hue: number, saturation: number, primary: string, from: number) {
  const base = parseHex(primary);
  for (let lightness = from + 1; lightness <= from + 30; lightness += 1) {
    const candidate = hsl(hue, saturation, lightness);
    const rgb = parseHex(candidate);
    if (!base || !rgb) return candidate;
    if (contrastRatio(base, rgb) >= SAGE_SEPARATION) return candidate;
  }
  // Un tono al que no le queda recorrido hacia arriba (el amarillo en claro es
  // el candidato). Devolver lo más separado que se pudo es mejor que devolver
  // el primario otra vez, y el test lo caza si algún día pasa.
  return hsl(hue, saturation, Math.min(from + 30, 100));
}

const SPECS: readonly PaletteSpec[] = [
  // La verde no lleva spec: es la de arriba, afinada a mano desde el logo.
  {
    id: 'orange',
    label: 'Naranja',
    hue: 26,
    saturation: 62,
    lightL: 40,
    darkL: 62,
    neutralSaturation: 24,
    accent: [38, 60, 46],
  },
  {
    id: 'blue',
    label: 'Azul',
    hue: 212,
    saturation: 48,
    lightL: 40,
    darkL: 66,
    neutralSaturation: 22,
    accent: [196, 55, 40],
  },
  {
    id: 'pink',
    label: 'Rosa',
    hue: 338,
    saturation: 48,
    lightL: 43,
    darkL: 70,
    neutralSaturation: 22,
    accent: [350, 55, 46],
  },
  {
    id: 'purple',
    label: 'Morado',
    hue: 274,
    saturation: 38,
    lightL: 45,
    darkL: 72,
    neutralSaturation: 20,
    accent: [290, 42, 48],
  },
  {
    // El amarillo es el caso que obliga a que la luminosidad sea un parámetro:
    // sobre papel hay que bajarlo hasta el ocre para que se lea, y en oscuro
    // subirlo hasta el amarillo de verdad. Al mismo número, uno de los dos
    // esquemas queda ilegible.
    id: 'yellow',
    label: 'Amarillo',
    hue: 44,
    saturation: 62,
    lightL: 31,
    darkL: 62,
    neutralSaturation: 28,
    accent: [30, 60, 42],
  },
  {
    id: 'red',
    label: 'Rojo',
    hue: 6,
    saturation: 52,
    lightL: 41,
    darkL: 64,
    neutralSaturation: 22,
    accent: [32, 58, 45],
    // Aquí `danger` tiene que apartarse: un botón de acción rojo y un botón de
    // borrar rojo son el mismo botón hasta que lo pulsas.
    danger: { light: '#8C2418', dark: '#F09A86' },
  },
  {
    // Sin tono: `hsl(x, 0, l)` es gris a cualquier x. El acento también, o las
    // estrellas serían la única cosa con color de una paleta que se eligió por
    // no tenerlo.
    id: 'grey',
    label: 'Escala de grises',
    hue: 0,
    saturation: 0,
    lightL: 36,
    darkL: 70,
    neutralSaturation: 0,
    accent: [0, 0, 40],
  },
];

/**
 * Un esquema claro a partir de un tono.
 *
 * Las luminosidades son las de la paleta verde medidas una a una; lo único que
 * cambia entre paletas es el tono y cuánta saturación se le deja. Es lo que hace
 * que las ocho se sientan la misma app: la estructura de claros y oscuros es
 * idéntica, el color es lo de encima.
 */
function buildLight(spec: PaletteSpec): ThemeColors {
  const { hue, saturation: sat, lightL, neutralSaturation: ns } = spec;
  const [ah, as, al] = spec.accent;
  const primary = hsl(hue, sat, lightL);

  return {
    canvas: hsl(hue, ns, 93),
    // Blanco, no un blanco teñido: la tarjeta es el papel sobre el que se lee, y
    // un papel de color reduce el contraste de todo lo que lleva encima.
    surface: '#FFFFFF',
    surfaceAlt: hsl(hue, ns, 97),
    sunken: hsl(hue, ns - 2, 88),
    line: hsl(hue, ns - 2, 88),
    lineStrong: hsl(hue, ns - 4, 80),
    ink: hsl(hue, Math.min(ns + 6, 34), 13),
    inkMuted: hsl(hue, Math.round(ns * 0.5), 35),
    inkSubtle: hsl(hue, Math.round(ns * 0.4), 50),
    primary,
    primaryPressed: hsl(hue, sat + 2, lightL - 7),
    onPrimary: '#FFFFFF',
    accent: hsl(ah, as, al),
    // Aparte del primario por luminosidad, no por tono: lo que los separa es la
    // forma —uno rellena botones, el otro tiñe pastillas— y compartir familia es
    // deliberado (ver el comentario de la paleta verde).
    sage: separatedFromPrimary(hue - 10, sat + 8, primary, lightL),
    danger: (spec.danger ?? DANGER).light,
    inverse: hsl(hue, Math.min(ns + 6, 34), 13),
    onInverse: hsl(hue, ns, 93),
  };
}

/**
 * Y el oscuro.
 *
 * Los seis neutros van a un 3% de saturación como mucho, y eso **no es una
 * elección estética sino la corrección de la ronda 8**: teñirlos como los del
 * modo claro convirtió cada tarjeta en un bloque café. En oscuro hay mucha más
 * superficie por la que un tinte se acumula.
 */
function buildDark(spec: PaletteSpec): ThemeColors {
  const { hue, saturation: sat, darkL, neutralSaturation: ns } = spec;
  const [ah, as, al] = spec.accent;
  // Un rastro del tono y nada más. La verde se quedó en dos o tres puntos.
  const tint = ns === 0 ? 0 : 3;

  const canvas = hsl(hue, tint, 10);
  const primary = hsl(hue, sat + 9, darkL);

  return {
    canvas,
    surface: hsl(hue, tint, 14),
    surfaceAlt: hsl(hue, tint, 16),
    sunken: hsl(hue, tint, 7),
    line: hsl(hue, tint, 19),
    lineStrong: hsl(hue, tint, 25),
    ink: hsl(hue, tint, 93),
    inkMuted: hsl(hue, tint, 66),
    inkSubtle: hsl(hue, tint, 50),
    primary,
    // Más claro al pulsar, no más oscuro: sobre un lienzo oscuro, oscurecer se
    // lee como «desactivado».
    primaryPressed: hsl(hue, sat + 16, darkL + 8),
    // Tinta y no blanco: sobre un primario claro, el blanco da 3:1 y es
    // ilegible en un botón. `tokens.node.test.ts` vigila la pareja.
    onPrimary: canvas,
    accent: hsl(ah, as + 11, al + 13),
    sage: separatedFromPrimary(hue - 10, sat + 18, primary, darkL),
    danger: (spec.danger ?? DANGER).dark,
    // El inverso de un esquema oscuro es el papel del claro, y al revés.
    inverse: hsl(hue, ns, 93),
    onInverse: hsl(hue, Math.min(ns + 6, 34), 13),
  };
}

/** Las ocho, listas para pintar. La verde entra tal cual, sin generar. */
export const PALETTES: Record<PaletteId, Palette> = {
  green: { id: 'green', label: 'Verde', light: lightColors, dark: darkColors },
  ...(Object.fromEntries(
    SPECS.map((spec) => [
      spec.id,
      { id: spec.id, label: spec.label, light: buildLight(spec), dark: buildDark(spec) },
    ]),
  ) as Record<Exclude<PaletteId, 'green'>, Palette>),
};

export const DEFAULT_PALETTE: PaletteId = 'green';

export function isPaletteId(value: string): value is PaletteId {
  return (PALETTE_IDS as readonly string[]).includes(value);
}

/**
 * Los colores como variables CSS, para dárselos a NativeWind en caliente.
 *
 * `global.css` declara la paleta verde y no puede declarar las otras siete: es
 * un fichero estático que Tailwind compila una vez. `vars()` de NativeWind
 * redefine esas mismas variables sobre una vista, así que **todas las clases
 * siguen funcionando sin tocar ni una** — `bg-surface` resuelve por la variable,
 * y la variable es la que cambia.
 *
 * Los valores van en canales RGB separados por espacios porque es lo que espera
 * `rgb(var(--color-x) / <alpha-value>)` de `tailwind.config.js`. Sin eso, los
 * modificadores de opacidad (`bg-primary/12`, que la app usa en bastantes
 * sitios) dejarían de resolver y esos fondos saldrían transparentes.
 */
export function paletteVars(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, hex] of Object.entries(colors)) {
    const rgb = parseHex(hex);
    if (!rgb) continue;
    vars[`--color-${kebabCase(name)}`] = `${rgb.r} ${rgb.g} ${rgb.b}`;
  }
  return vars;
}

/** `inkMuted` → `ink-muted`, que es como se llaman en `global.css`. */
function kebabCase(name: string): string {
  return name.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();
}

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
 * (Fraunces) and the text face (Manrope) want opposite treatment: the serif
 * wants neutral tracking at large sizes, the sans wants slightly negative
 * tracking at small ones.
 *
 * ## Por qué el interlineado de los títulos es tan holgado
 *
 * Porque la «g» de «¿Desayunaste en algún sitio?» salía **cortada por abajo**.
 *
 * No era un fallo de la fuente: en Android, un `lineHeight` explícito fija la
 * altura de la caja de línea, y lo que no cabe dentro se recorta — no se
 * desborda, desaparece. `hero` estaba en 38 sobre 34 px (un 1,12), que es un
 * interlineado apretado de los que quedan muy bien en una maqueta con texto de
 * relleno sin descendentes.
 *
 * Y **Fraunces las tiene largas a propósito**: es la letra con formas raras que
 * se eligió justo por eso (ver `fonts`). Una cara con carácter necesita sitio
 * donde tenerlo, así que los tres tamaños que la usan —`hero`, `display`,
 * `title`— van por encima de 1,3, que es donde la «g», la «y» y la «j» entran
 * enteras con margen. `tokens.node.test.ts` fija ese suelo: bajarlo vuelve a
 * cortar letras, y cortar letras no rompe ningún test que mire el texto, porque
 * la cadena sigue estando entera.
 *
 * Las variantes de la sans se quedan como estaban: Manrope tiene descendentes
 * cortas y sus proporciones ya llevan sitio de sobra.
 */
export const type = {
  hero: { fontSize: 34, lineHeight: 45, letterSpacing: -0.5 },
  display: { fontSize: 27, lineHeight: 36, letterSpacing: -0.3 },
  title: { fontSize: 20, lineHeight: 27, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21 },
  callout: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12.5, lineHeight: 17 },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
} as const;

/**
 * Las variantes que se pintan con la serif si nadie dice lo contrario.
 *
 * Vive aquí y no en `Txt` porque el test del interlineado necesita saber
 * cuáles son, y tener la lista escrita dos veces es como una de las dos se
 * queda atrás sin que falle nada.
 */
export const DISPLAY_VARIANTS = ['hero', 'display', 'title'] as const;
