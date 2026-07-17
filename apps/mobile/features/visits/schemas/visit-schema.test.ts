import { visitSchema } from './visit-schema';

describe('visitSchema', () => {
  it('accepts visits with numeric dish ids', () => {
    const result = visitSchema.safeParse({
      visited_at: '2026-03-09',
      comments: 'Gran experiencia',
      restaurantId: 1,
      dishes: [10, 20],
    });

    expect(result.success).toBe(true);
  });

  it('rejects visits without selected dishes', () => {
    const result = visitSchema.safeParse({
      visited_at: '2026-03-09',
      comments: '',
      restaurantId: 1,
      dishes: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dishes).toContain(
        'Debes seleccionar al menos un plato',
      );
    }
  });
});
