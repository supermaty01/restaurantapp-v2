import { dishSchema, dishWriteValues, type DishFormData } from './dish-schema';

describe('dishSchema', () => {
  it('coerces valid numeric price strings', () => {
    const result = dishSchema.safeParse({
      name: 'Pasta',
      restaurantId: 1,
      comments: 'Hecha en casa',
      price: '1500',
      currency: 'COP',
      rating: 4,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(1500);
    }
  });

  it('rejects missing restaurant selection', () => {
    const result = dishSchema.safeParse({
      name: 'Pasta',
      restaurantId: 0,
      comments: '',
      price: '1500',
      currency: 'COP',
      rating: 4,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.restaurantId).toContain(
        'Selecciona un restaurante',
      );
    }
  });

  it('rechaza una moneda que la app no conoce', () => {
    const result = dishSchema.safeParse({
      name: 'Pasta',
      restaurantId: 1,
      price: '12',
      currency: 'XYZ',
    });

    expect(result.success).toBe(false);
  });
});

/**
 * Precio y moneda van juntos, siempre.
 *
 * Es la regla que hace que un precio signifique algo. Se prueba aquí y no en
 * cada pantalla porque las dos —crear y editar— pasan por la misma función,
 * que es justamente el motivo de que exista.
 */
describe('dishWriteValues', () => {
  const base: DishFormData = { name: 'Pasta', restaurantId: 1, currency: 'EUR' };

  it('con precio, guarda la moneda elegida', () => {
    expect(dishWriteValues({ ...base, price: 12.5 })).toEqual({ price: 12.5, currency: 'EUR' });
  });

  it('sin precio, no guarda moneda', () => {
    // Una moneda huérfana no rompe nada hoy, y por eso hay que vigilarla: se
    // quedaría en la fila para siempre y viajaría por el sync sin significar
    // nada.
    expect(dishWriteValues(base)).toEqual({ price: null, currency: null });
  });

  it('quitar el precio quita también la moneda', () => {
    // El caso real: editar un plato que tenía precio y borrarlo del campo. Un
    // cero también cuenta como «sin precio» — un plato gratis se apunta con un
    // comentario, no con un cero.
    expect(dishWriteValues({ ...base, price: 0 })).toEqual({ price: null, currency: null });
  });
});
