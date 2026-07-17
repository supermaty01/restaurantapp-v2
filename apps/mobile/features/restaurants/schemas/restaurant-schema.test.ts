import { restaurantSchema } from './restaurant-schema';

describe('restaurantSchema', () => {
  it('accepts a complete restaurant payload', () => {
    const result = restaurantSchema.safeParse({
      name: 'La Trattoria',
      comments: 'Muy bueno',
      rating: 5,
      location: {
        latitude: -34.6,
        longitude: -58.4,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing names', () => {
    const result = restaurantSchema.safeParse({
      name: '',
      comments: null,
      rating: null,
      location: null,
    });

    expect(result.success).toBe(false);
  });
});
