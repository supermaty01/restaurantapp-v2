import { describe, expect, it } from 'vitest';

import { CURRENT_SHARE_VERSION, parseShareFile } from './share-file';

/**
 * El fichero compartido es la única entrada no confiable de la app: lo entrega
 * el sistema desde un adjunto o una descarga, y nadie garantiza quién lo
 * escribió. Estos casos son los que antes pasaban de largo con un `as`.
 */

const minimalRestaurant = {
  version: 1,
  type: 'restaurant' as const,
  createdAt: '2026-07-26T10:00:00.000Z',
  restaurant: {
    name: 'Ichiran',
    latitude: 35.6,
    longitude: 139.7,
    comments: 'Ramen de verdad',
    rating: 5,
    tags: [{ name: 'ramen', color: '#C2603C' }],
    images: [],
  },
};

describe('parseShareFile', () => {
  it('acepta un fichero bien formado', () => {
    const result = parseShareFile(minimalRestaurant);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.restaurant?.name).toBe('Ichiran');
  });

  it('rellena los campos que la v1 omitía', () => {
    // Un fichero de la versión anterior no traía `tags` ni `images`, y trataba
    // "sin comentario" como campo ausente en vez de nulo. Rechazarlo sería
    // perder el diario de alguien por una distinción que no existe.
    const result = parseShareFile({
      version: 1,
      type: 'dish',
      createdAt: '2026-01-01T00:00:00.000Z',
      dish: { name: 'Tonkotsu' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dish?.tags).toEqual([]);
      expect(result.data.dish?.images).toEqual([]);
      expect(result.data.dish?.comments).toBeNull();
      expect(result.data.dish?.price).toBeNull();
    }
  });

  it('rechaza un tipo que no existe', () => {
    const result = parseShareFile({ ...minimalRestaurant, type: 'postre' });
    expect(result.ok).toBe(false);
  });

  it('rechaza un campo con el tipo cambiado', () => {
    // El caso que motivó todo esto: `as ShareFileData` afirmaba que esto era
    // un número, y de ahí se iba derecho a un insert.
    const result = parseShareFile({
      ...minimalRestaurant,
      restaurant: { ...minimalRestaurant.restaurant, rating: 'cinco estrellas' },
    });
    expect(result.ok).toBe(false);
  });

  it('rechaza una puntuación fuera de rango', () => {
    const result = parseShareFile({
      ...minimalRestaurant,
      restaurant: { ...minimalRestaurant.restaurant, rating: 99 },
    });
    expect(result.ok).toBe(false);
  });

  it('rechaza etiquetas que no son una lista', () => {
    const result = parseShareFile({
      ...minimalRestaurant,
      restaurant: { ...minimalRestaurant.restaurant, tags: 5 },
    });
    expect(result.ok).toBe(false);
  });

  it('rechaza una foto absurdamente grande', () => {
    const result = parseShareFile({
      ...minimalRestaurant,
      restaurant: {
        ...minimalRestaurant.restaurant,
        images: [{ base64: 'A'.repeat(6_000_001), filename: 'enorme.jpg' }],
      },
    });
    expect(result.ok).toBe(false);
  });

  it('explica que una versión futura no se sabe leer', () => {
    const result = parseShareFile({
      ...minimalRestaurant,
      version: CURRENT_SHARE_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    // El motivo importa: «no se pudo abrir» no distingue un fichero corrupto de
    // uno que solo pide actualizar la app.
    if (!result.ok) expect(result.reason).toContain('Actualiza la app');
  });

  it('no revienta con entradas que ni siquiera son objetos', () => {
    expect(parseShareFile(null).ok).toBe(false);
    expect(parseShareFile('{}').ok).toBe(false);
    expect(parseShareFile([]).ok).toBe(false);
    expect(parseShareFile(42).ok).toBe(false);
  });
});
