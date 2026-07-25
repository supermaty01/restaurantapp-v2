import { createDish } from '@/features/dishes/repositories/dishRepository';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { createVisit } from '@/features/visits/repositories/visitRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import type { AppDatabase } from '@/services/db/types';

import {
  countDishOccurrences,
  countVisitsWithPerson,
  lastVisitWithPerson,
  searchDishes,
} from './queries';

/**
 * Seeds the diary with the scenarios from docs/07: carbonaras in Rome and
 * elsewhere, and meals with Caro on known dates.
 */
async function seedDiary(db: AppDatabase) {
  const roma = await createRestaurant(db, {
    name: 'Roma Trattoria',
    comments: null,
    rating: 5,
    latitude: 41.9,
    longitude: 12.5,
  });
  const local = await createRestaurant(db, {
    name: 'Guadalupe',
    comments: null,
    rating: 4,
    latitude: 25.6,
    longitude: -100.3,
  });

  const carbonaraRoma = await createDish(db, {
    name: 'Carbonara',
    price: 1500,
    rating: 5,
    comments: null,
    restaurantId: roma,
  });
  const carbonaraLocal = await createDish(db, {
    name: 'Pasta a la carbonara',
    price: 1200,
    rating: 4,
    comments: null,
    restaurantId: local,
  });
  const burger = await createDish(db, {
    name: 'Hamburguesa',
    price: 1000,
    rating: 3,
    comments: null,
    restaurantId: local,
  });

  // Two carbonaras in Rome, one elsewhere.
  await createVisit(db, { visitedAt: '2026-03-01', comments: null, restaurantId: roma }, [
    carbonaraRoma,
  ]);
  await createVisit(db, { visitedAt: '2026-04-10', comments: null, restaurantId: roma }, [
    carbonaraRoma,
  ]);
  await createVisit(db, { visitedAt: '2026-05-01', comments: null, restaurantId: local }, [
    carbonaraLocal,
  ]);

  // Burgers, and meals with Caro.
  await createVisit(
    db,
    { visitedAt: '2026-02-15', comments: null, restaurantId: local },
    [burger],
    [{ name: 'Caro' }],
  );
  await createVisit(
    db,
    { visitedAt: '2026-06-20', comments: null, restaurantId: local },
    [burger],
    [{ name: 'Caro' }, { name: 'Irene' }],
  );
}

describe('assistant queries', () => {
  it('counts carbonaras in Rome (name + restaurant filter)', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);

    const inRome = await countDishOccurrences(db, {
      dishQuery: 'carbonara',
      restaurantQuery: 'roma',
    });
    expect(inRome).toBe(2);

    // Matches the fuzzy "pasta a la carbonara" too when unrestricted.
    const everywhere = await countDishOccurrences(db, { dishQuery: 'carbonara' });
    expect(everywhere).toBe(3);
  });

  it('counts dishes within a date range ("este año")', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);

    const q2 = await countDishOccurrences(db, {
      dishQuery: 'hamburguesa',
      from: '2026-06-01',
      to: '2026-12-31',
    });
    expect(q2).toBe(1); // only the June burger
  });

  it('finds the last visit with a person', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);

    const last = await lastVisitWithPerson(db, 'Caro');
    expect(last?.visitedAt).toBe('2026-06-20');
    expect(last?.restaurantName).toBe('Guadalupe');
  });

  it('counts visits with a person', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);
    expect(await countVisitsWithPerson(db, 'Caro')).toBe(2);
    expect(await countVisitsWithPerson(db, 'Irene')).toBe(1);
  });

  it('resolves fuzzy dish names to candidates', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);
    const matches = await searchDishes(db, 'carbonara');
    expect(matches.map((m) => m.name).sort()).toEqual(['Carbonara', 'Pasta a la carbonara']);
  });

  it('treats LIKE wildcards in user input literally', async () => {
    const { db } = makeTestDb();
    await seedDiary(db);
    const bar = await createRestaurant(db, {
      name: 'Bar',
      comments: null,
      rating: null,
      latitude: null,
      longitude: null,
    });
    const promo = await createDish(db, {
      name: 'Menú 100% vegano',
      price: 900,
      rating: 4,
      comments: null,
      restaurantId: bar,
    });
    await createVisit(db, { visitedAt: '2026-07-01', comments: null, restaurantId: bar }, [promo]);

    // A literal "%" in the name must be findable...
    expect(await countDishOccurrences(db, { dishQuery: '100%' })).toBe(1);
    // ...and a lone "%" must not behave as "match anything".
    expect(await countDishOccurrences(db, { dishQuery: '%' })).toBe(1);
    // "_" is a single-char wildcard in LIKE; it must be literal too.
    expect(await countDishOccurrences(db, { dishQuery: 'Men_' })).toBe(0);
  });
});
