import { mapVisitListRows } from './mapVisitListRows';

describe('mapVisitListRows', () => {
  it('groups visit rows and normalizes image paths', () => {
    const visits = mapVisitListRows([
      {
        visitId: 7,
        visitedAt: '2026-03-09',
        visitComments: 'Excelente',
        visitDeleted: false,
        restaurantId: 2,
        restaurantName: 'Parrilla',
        restaurantDeleted: false,
        imageId: 11,
        imagePath: '/tmp/visit.jpg',
      },
      {
        visitId: 7,
        visitedAt: '2026-03-09',
        visitComments: 'Excelente',
        visitDeleted: false,
        restaurantId: 2,
        restaurantName: 'Parrilla',
        restaurantDeleted: false,
        imageId: 11,
        imagePath: '/tmp/visit.jpg',
      },
    ]);

    expect(visits).toHaveLength(1);
    expect(visits[0].restaurant.name).toBe('Parrilla');
    expect(visits[0].images).toHaveLength(1);
    expect(visits[0].images[0].uri).toBe('file:///documents/images/visit.jpg');
  });
});
