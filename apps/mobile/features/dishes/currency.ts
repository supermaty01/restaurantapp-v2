import { formatPrice, isKnownCurrency } from '@/features/settings/currency';

/**
 * La frontera del reparto histórico, en la moneda del propio número.
 *
 * La app solo se ha usado en Colombia y en Europa, así que el precio basta para
 * saber en qué moneda se escribió: por debajo de mil, euros; de mil en adelante,
 * pesos. No hay platos de mil euros y no hay platos de novecientos pesos, así
 * que la frontera no parte ningún caso real.
 *
 * **Es una heurística, y está escrito que lo es.** Lo correcto era guardar la
 * moneda desde el principio; esto es lo que se puede deducir de lo que ya está
 * escrito sin preguntarle a nadie. El día que se importe un diario de otro sitio
 * dejará de valer, y entonces habrá que preguntar en vez de adivinar.
 *
 * Vive aquí y **también en SQL** (`drizzle/0013`, `supabase/0023`), y eso es a
 * propósito, no una copia olvidada: la migración reparte de una vez lo que hay
 * en disco, y esta función cubre lo que llegue después sin moneda —una fila
 * sincronizada desde un móvil con la versión anterior—. Sin ella, ese plato se
 * pintaría con la moneda que tenga puesta quien mira, que es exactamente el
 * fallo que la columna vino a arreglar.
 */
const LEGACY_BOUNDARY = 1000;

export function currencyForLegacyPrice(price: number): string {
  return price < LEGACY_BOUNDARY ? 'EUR' : 'COP';
}

/**
 * La moneda de un plato, mirándolo.
 *
 * Devuelve `null` cuando no hay precio: una moneda sin precio no dice nada, y
 * enseñarla sería decorar un dato que no existe.
 */
export function dishCurrency(price: number | null, stored: string | null): string | null {
  if (price === null) return null;
  if (stored && isKnownCurrency(stored)) return stored;
  return currencyForLegacyPrice(price);
}

/** Lo que se pinta donde hay un precio, o `null` si no lo hay. */
export function formatDishPrice(price: number | null, stored: string | null): string | null {
  const currency = dishCurrency(price, stored);
  return currency === null || price === null ? null : formatPrice(price, currency);
}
