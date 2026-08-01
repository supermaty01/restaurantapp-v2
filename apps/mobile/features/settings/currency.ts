/**
 * En qué moneda están los precios del diario.
 *
 * Antes era una constante: `Intl.NumberFormat('es-CO', { currency: 'COP' })`
 * escrita a mano en el detalle de plato. Un diario que se lleva de viaje —que
 * es de lo que va la app— pone precios en la moneda del sitio donde comes, y
 * enseñarlos todos con el símbolo equivocado no es un detalle estético: dice un
 * número falso.
 *
 * **Este fichero es la lista de monedas y cómo se escribe un precio; ya no es
 * "la moneda del diario".** Aquí decía que una moneda por fila sería lo correcto
 * en un gestor de gastos y aquí un campo más que llenar en cada comida. El coste
 * era real y el efecto estaba mal medido: un diario que se lleva de viaje mezcla
 * platos de Bogotá y de Madrid en la misma lista, y con una sola moneda la mitad
 * de los números decían otra cosa de la que costaron. Desde 0013 la moneda vive
 * en el plato (`services/db/schema.ts`), y `useCurrency` es solo el valor de
 * partida de lo nuevo.
 *
 * Lo que sigue siendo verdad: **nada convierte importes**. Hacerlo necesitaría
 * un tipo de cambio por fecha, que es una API de pago (docs/11). Cambiar la
 * moneda de un plato cambia la unidad, no el número — y eso es lo correcto
 * cuando lo que se está arreglando es un precio mal etiquetado.
 */
export interface Currency {
  code: string;
  /** Cómo se llama, en español. */
  label: string;
}

/**
 * Las que se ofrecen, y por qué esta lista y no las 180 de la ISO.
 *
 * Una lista completa es un buscador y un problema de diseño; ésta cubre el sitio
 * donde vive quien usa la app y los destinos que aparecen en un diario
 * gastronómico. Añadir una es una línea.
 */
export const CURRENCIES: Currency[] = [
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'Dólar estadounidense' },
  { code: 'MXN', label: 'Peso mexicano' },
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'CLP', label: 'Peso chileno' },
  { code: 'PEN', label: 'Sol peruano' },
  { code: 'BRL', label: 'Real brasileño' },
  { code: 'GBP', label: 'Libra esterlina' },
  { code: 'JPY', label: 'Yen japonés' },
  { code: 'CHF', label: 'Franco suizo' },
  { code: 'CAD', label: 'Dólar canadiense' },
];

/**
 * Lo que se usa mientras no haya preferencia guardada y no se sepa nada del
 * dispositivo. Es lo que la app hacía antes, así que nadie ve un cambio.
 */
export const FALLBACK_CURRENCY = 'COP';

/**
 * La moneda de una región, para adivinar la primera vez.
 *
 * Se mira la **región** y no el idioma: `es` no dice nada —lo hablan veinte
 * países con veinte monedas— mientras que `es-CO` y `es-ES` sí. Solo están las
 * regiones de `CURRENCIES`; cualquier otra cae al valor por defecto, que es
 * mejor que ofrecer una moneda que la lista no puede cambiar después.
 */
const CURRENCY_BY_REGION: Record<string, string> = {
  CO: 'COP',
  ES: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  US: 'USD',
  EC: 'USD',
  PA: 'USD',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
  BR: 'BRL',
  GB: 'GBP',
  JP: 'JPY',
  CH: 'CHF',
  CA: 'CAD',
};

/**
 * La región de una etiqueta de idioma: `es-CO` → `CO`, `es-419` → null.
 *
 * Se salta el primer trozo a propósito, que es el idioma y también tiene dos
 * letras: buscar «el primer trozo de dos letras» en `es-CO` devuelve `es`, y de
 * ahí salía la moneda de España para un móvil colombiano.
 */
export function regionOf(locale: string): string | null {
  const region = locale
    .split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
}

/**
 * Qué moneda proponer la primera vez, deducida del dispositivo.
 *
 * Sale de `Intl` y no de `expo-localization` a propósito: hace falta un dato,
 * no un módulo nativo — y un módulo nativo más es un APK más que construir
 * (docs/11). Si el motor no trae `Intl` o la región no está en la tabla, se cae
 * al valor por defecto; la persona puede cambiarlo en Ajustes, que es el punto.
 */
export function detectCurrency(locale: string | undefined = safeResolvedLocale()): string {
  const region = locale ? regionOf(locale) : null;
  return (region && CURRENCY_BY_REGION[region]) || FALLBACK_CURRENCY;
}

function safeResolvedLocale(): string | undefined {
  try {
    return new Intl.NumberFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export function isKnownCurrency(code: string): boolean {
  return CURRENCIES.some((currency) => currency.code === code);
}

/**
 * Un precio, con su símbolo.
 *
 * `minimumFractionDigits: 0` y `maximumFractionDigits: 2` en vez de dejar los
 * de cada moneda: los del peso colombiano son cero decimales, así que un plato
 * de 12,50 se redondeaba a 13 — que es exactamente el error que la columna
 * `real` acaba de dejar de cometer, cometido otra vez al pintarlo. Y al revés,
 * fijar dos decimales llenaría de «,00» un diario donde casi nada los tiene.
 */
export function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Un código que `Intl` no conoce no puede dejar la pantalla en blanco.
    return `${value} ${currency}`;
  }
}
