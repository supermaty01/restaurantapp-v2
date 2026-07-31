/**
 * La moneda de un precio.
 *
 * Vive **en el plato** y no solo en los ajustes. Un diario de comidas viaja: el
 * mismo cuaderno tiene un menú del día en Madrid y un corrientazo en Bogotá, y
 * una moneda global convierte todos los precios pasados en la moneda del sitio
 * donde estés ahora. Lo que se apuntó en euros se apuntó en euros para siempre.
 *
 * El ajuste general sigue existiendo, con otro papel: es lo que se propone al
 * crear algo nuevo. A diferencia del `default` de visibilidad —que se guarda sin
 * resolver y sigue al ajuste toda la vida— aquí **se copia al guardar**, porque
 * cambiar de país no puede reescribir lo que pagaste el mes pasado.
 */

export interface CurrencyMeta {
  code: string;
  /** Cómo se escribe delante del número. */
  symbol: string;
  label: string;
  /** Decimales con los que se piensa el precio en ese país. */
  decimals: number;
  /** Locale con el que agrupar los miles como los lee quien usa esa moneda. */
  locale: string;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'EUR', symbol: '€', label: 'Euro', decimals: 2, locale: 'es-ES' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano', decimals: 0, locale: 'es-CO' },
  { code: 'USD', symbol: '$', label: 'Dólar', decimals: 2, locale: 'en-US' },
  { code: 'GBP', symbol: '£', label: 'Libra', decimals: 2, locale: 'en-GB' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano', decimals: 2, locale: 'es-MX' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino', decimals: 2, locale: 'es-AR' },
  { code: 'CLP', symbol: '$', label: 'Peso chileno', decimals: 0, locale: 'es-CL' },
  { code: 'PEN', symbol: 'S/', label: 'Sol', decimals: 2, locale: 'es-PE' },
  { code: 'BRL', symbol: 'R$', label: 'Real', decimals: 2, locale: 'pt-BR' },
];

/** La que se usa si nunca se ha elegido ninguna. */
export const FALLBACK_CURRENCY = 'EUR';

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export function isCurrencyCode(value: string): boolean {
  return BY_CODE.has(value);
}

export function currencyMeta(code: string | null | undefined): CurrencyMeta | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

/**
 * Un precio, tal y como se escribe donde se pagó.
 *
 * Sin moneda no se inventa ninguna: se enseña el número pelado. Un precio
 * etiquetado con la moneda equivocada miente con más convicción que un precio
 * sin etiquetar, y aquí hay filas antiguas que pueden no tenerla.
 */
export function formatPrice(price: number | null | undefined, code: string | null): string | null {
  if (price === null || price === undefined || Number.isNaN(price)) return null;

  const meta = currencyMeta(code);
  if (!meta) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(price);
  }

  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  }).format(price);
}

/**
 * Qué moneda tenía un precio escrito antes de que existiera esta columna.
 *
 * La app solo se ha usado en Colombia y en Europa, y las dos escalas no se
 * solapan: un plato de menos de 1000 no existe en pesos —el café más barato pasa
 * de 2000— y uno de más de 1000 no existe en euros. Así que el propio número
 * dice de dónde viene, y esa es toda la información que hay.
 *
 * Está aquí, y no solo dentro del SQL de la migración, porque es una decisión
 * que hay que poder leer y probar; el SQL la repite porque una migración no
 * puede llamar a TypeScript.
 */
export const LEGACY_PRICE_THRESHOLD = 1000;

export function guessLegacyCurrency(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  return price < LEGACY_PRICE_THRESHOLD ? 'EUR' : 'COP';
}

/**
 * Precio y moneda van juntos o no van.
 *
 * Un precio sin moneda es un número que no significa nada, y una moneda sin
 * precio es una etiqueta sobre nada. Las dos escrituras pasan por aquí para que
 * no exista una fila a medias.
 */
export function pairPriceAndCurrency(
  price: number | null | undefined,
  currency: string | null | undefined,
  fallback: string,
): { price: number | null; currency: string | null } {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return { price: null, currency: null };
  }
  const code = currency && isCurrencyCode(currency) ? currency : fallback;
  return { price, currency: code };
}
