import { mapDishListRows } from './mapDishListRows';

describe('mapDishListRows', () => {
  it('skips rows without a dish id and deduplicates tags/images', () => {
    const dishes = mapDishListRows([
      {
        dishId: null,
        dishName: null,
        dishComments: null,
        dishRating: null,
      },
      {
        dishId: 1,
        dishName: 'Ramen',
        dishComments: 'Picante',
        dishRating: 4,
        dishDeleted: false,
        tagId: 5,
        tagName: 'Spicy',
        tagColor: '#f00',
        tagDeleted: false,
        imageId: 20,
        imagePath: '/tmp/ramen.jpg',
      },
      {
        dishId: 1,
        dishName: 'Ramen',
        dishComments: 'Picante',
        dishRating: 4,
        dishDeleted: false,
        tagId: 5,
        tagName: 'Spicy',
        tagColor: '#f00',
        tagDeleted: false,
        imageId: 20,
        imagePath: '/tmp/ramen.jpg',
      },
    ]);

    expect(dishes).toHaveLength(1);
    expect(dishes[0].tags).toHaveLength(1);
    expect(dishes[0].images).toHaveLength(1);
    expect(dishes[0].images[0].uri).toBe('file:///documents/images/ramen.jpg');
  });
});
