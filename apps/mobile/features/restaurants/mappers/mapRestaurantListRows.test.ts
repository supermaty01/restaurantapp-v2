import { mapRestaurantListRows } from './mapRestaurantListRows';

describe('mapRestaurantListRows', () => {
  it('groups repeated rows into unique restaurants, tags, and images', () => {
    const restaurants = mapRestaurantListRows([
      {
        restaurantId: 1,
        restaurantName: 'Bistro',
        restaurantComments: 'Great',
        restaurantRating: 5,
        restaurantDeleted: false,
        tagId: 10,
        tagName: 'Italian',
        tagColor: '#fff',
        imageId: 100,
        imagePath: '/tmp/restaurant.jpg',
      },
      {
        restaurantId: 1,
        restaurantName: 'Bistro',
        restaurantComments: 'Great',
        restaurantRating: 5,
        restaurantDeleted: false,
        tagId: 10,
        tagName: 'Italian',
        tagColor: '#fff',
        imageId: 100,
        imagePath: '/tmp/restaurant.jpg',
      },
    ]);

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].tags).toHaveLength(1);
    expect(restaurants[0].images).toHaveLength(1);
    expect(restaurants[0].images[0].uri).toBe('file:///documents/images/restaurant.jpg');
  });
});
