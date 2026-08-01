import { z } from 'zod';

/**
 * El formato del fichero `.restoshare`, como esquema y no como interfaz.
 *
 * Este fichero llega de fuera: lo abre el sistema desde un adjunto, una
 * descarga o AirDrop, y nadie garantiza que lo haya escrito esta app. Hasta
 * ahora se leía con `JSON.parse(content) as ShareFileData` — un `as`, que en
 * TypeScript no comprueba nada: afirma. Un fichero con `rating: "borra todo"` o
 * con `tags: 5` pasaba el "control" y sus campos entraban directos a un
 * `insert()`.
 *
 * El proyecto ya usa zod en todos los formularios. Ésta era la única entrada de
 * verdad no confiable de la app y era la única sin validar, que es exactamente
 * al revés de como debería estar.
 *
 * Vive en `packages/shared` porque el Worker guarda este mismo payload como
 * contenido de un enlace compartido (ver `shareStore.ts`, que ya decía
 * "packages/shared schema" cuando el paquete estaba vacío).
 */

/** La versión que escribe esta app. Un fichero más nuevo no se sabe leer. */
export const CURRENT_SHARE_VERSION = 1;

export const SHARE_FILE_EXTENSION = '.restoshare';
export const SHARE_FILE_MIME_TYPE = 'application/x-restoshare';

/**
 * Topes de tamaño.
 *
 * No son paranoia: el fichero entero se lee a memoria de una vez, y las fotos
 * viajan como base64 dentro del JSON. Un `.restoshare` de doscientos megas no
 * es un ataque sofisticado, es arrastrar el fichero equivocado — y el resultado
 * es el mismo, la app muerta sin decir por qué. Con un tope, el fallo es un
 * mensaje.
 */
const MAX_TEXT = 20_000;
const MAX_NAME = 500;
/** ~4 MB por foto en base64 (base64 abulta un tercio sobre el binario). */
const MAX_IMAGE_BASE64 = 6_000_000;
const MAX_IMAGES = 50;
const MAX_TAGS = 100;
const MAX_DISHES = 500;

const shortText = z.string().max(MAX_NAME);
const longText = z.string().max(MAX_TEXT);

/** Puntuación de una a cinco estrellas, o sin puntuar. */
const rating = z.number().int().min(0).max(5).nullable();

export const shareableTagSchema = z.object({
  name: shortText,
  color: z.string().max(64),
});

export const shareableImageSchema = z.object({
  base64: z.string().max(MAX_IMAGE_BASE64),
  filename: shortText,
});

/**
 * `nullish().transform(...)` y no `nullable()` a secas: los ficheros escritos
 * por la v1 omiten campos que hoy existen, y un campo ausente significa lo mismo
 * que uno nulo. Rechazar el fichero por eso sería perder datos reales de alguien
 * para defender una distinción que no existe.
 */
const optionalNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);
const optionalText = longText.nullish().transform((value) => value ?? null);

export const shareableRestaurantSchema = z.object({
  name: shortText,
  latitude: optionalNumber,
  longitude: optionalNumber,
  comments: optionalText,
  rating: rating.nullish().transform((value) => value ?? null),
  tags: z.array(shareableTagSchema).max(MAX_TAGS).default([]),
  images: z.array(shareableImageSchema).max(MAX_IMAGES).default([]),
});

export const shareableDishSchema = z.object({
  name: shortText,
  price: optionalNumber,
  /**
   * En qué moneda está el precio.
   *
   * Opcional para poder **leer** los ficheros que ya existen, que no la traen:
   * un `.restoshare` escrito antes de 0013 lleva un número sin unidad, y ahí la
   * app que lo importa aplica la misma regla que la migración (por debajo de
   * mil, euros). Lo que se escribe a partir de ahora sí la lleva.
   *
   * `shortText` y no una lista cerrada: este fichero viene de fuera y la lista
   * de monedas de la app puede crecer. Un código que no se reconozca cae a la
   * regla de siempre en vez de rechazar el fichero entero.
   */
  currency: shortText.nullish().transform((value) => value ?? null),
  rating: rating.nullish().transform((value) => value ?? null),
  comments: optionalText,
  tags: z.array(shareableTagSchema).max(MAX_TAGS).default([]),
  images: z.array(shareableImageSchema).max(MAX_IMAGES).default([]),
});

export const shareableVisitSchema = z.object({
  visitedAt: z.string().max(MAX_NAME),
  comments: optionalText,
  images: z.array(shareableImageSchema).max(MAX_IMAGES).default([]),
});

export const shareEntityTypeSchema = z.enum(['restaurant', 'dish', 'visit']);

export const shareFileSchema = z.object({
  // El límite superior se comprueba aquí y no fuera: un fichero de una versión
  // futura trae campos que esta app no sabe interpretar, y adivinarlos es peor
  // que decir que no.
  version: z.number().int().min(1).max(CURRENT_SHARE_VERSION),
  type: shareEntityTypeSchema,
  createdAt: z.string().max(MAX_NAME),

  restaurant: shareableRestaurantSchema.optional(),
  dish: shareableDishSchema.optional(),
  visit: shareableVisitSchema.optional(),

  includedRestaurant: shareableRestaurantSchema.optional(),
  includedDishes: z.array(shareableDishSchema).max(MAX_DISHES).optional(),
});

export type ShareEntityType = z.infer<typeof shareEntityTypeSchema>;
export type ShareableTag = z.infer<typeof shareableTagSchema>;
export type ShareableImage = z.infer<typeof shareableImageSchema>;
export type ShareableRestaurant = z.infer<typeof shareableRestaurantSchema>;
export type ShareableDish = z.infer<typeof shareableDishSchema>;
export type ShareableVisit = z.infer<typeof shareableVisitSchema>;
export type ShareFileData = z.infer<typeof shareFileSchema>;

/**
 * Lee un `.restoshare` ya deserializado.
 *
 * Devuelve el motivo en vez de lanzar, porque quien llama tiene que enseñárselo
 * a una persona que acaba de tocar un fichero: «no se pudo abrir» sin más es lo
 * que había antes, y no distingue un fichero corrupto de uno de una versión más
 * nueva de la app.
 */
export function parseShareFile(
  input: unknown,
): { ok: true; data: ShareFileData } | { ok: false; reason: string } {
  const result = shareFileSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const version = (input as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > CURRENT_SHARE_VERSION) {
    return {
      ok: false,
      reason: `El fichero es de una versión más nueva (v${String(version)}). Actualiza la app.`,
    };
  }

  const first = result.error.issues[0];
  return {
    ok: false,
    reason: first
      ? `El fichero no tiene el formato esperado (${first.path.join('.') || 'raíz'}: ${first.message})`
      : 'El fichero no tiene el formato esperado',
  };
}
