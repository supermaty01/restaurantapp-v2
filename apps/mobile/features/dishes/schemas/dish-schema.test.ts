import { dishSchema } from './dish-schema';

describe('dishSchema', () => {
  it('coerces valid numeric price strings', () => {
    const result = dishSchema.safeParse({
      name: 'Pasta',
      restaurantId: 1,
      comments: 'Hecha en casa',
      price: '1500',
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
      rating: 4,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.restaurantId).toContain(
        'Selecciona un restaurante',
      );
    }
  });
});
