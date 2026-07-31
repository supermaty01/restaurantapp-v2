import { createDish } from '@/features/dishes/repositories/dishRepository';
import { createRestaurant } from '@/features/restaurants/repositories/restaurantRepository';
import { createVisit } from '@/features/visits/repositories/visitRepository';
import { makeTestDb } from '@/services/db/__tests__/test-db';
import type { AppDatabase } from '@/services/db/types';

import { ASSISTANT_TOOLS, runTool, toolSpecs } from './tools';

async function seed(db: AppDatabase) {
  const roma = await createRestaurant(db, {
    name: 'Roma',
    comments: null,
    rating: 5,
    latitude: null,
    longitude: null,
  });
  const carbonara = await createDish(db, {
    name: 'Carbonara',
    price: 1500,
    currency: 'COP',
    rating: 5,
    comments: null,
    restaurantId: roma,
  });
  await createVisit(db, { visitedAt: '2026-03-01', comments: null, restaurantId: roma }, [
    carbonara,
  ]);
}

describe('assistant tool dispatch', () => {
  it('runs a valid tool call and returns the result', async () => {
    const { db } = makeTestDb();
    await seed(db);

    const out = await runTool(db, 'count_dishes_eaten', { dishQuery: 'carbonara' });
    expect(out).toEqual({ result: 1 });
  });

  it('rejects an unknown tool', async () => {
    const { db } = makeTestDb();
    const out = await runTool(db, 'delete_everything', {});
    expect(out).toHaveProperty('error');
  });

  it('rejects invalid arguments with an error, not a throw', async () => {
    const { db } = makeTestDb();
    // dishQuery is required and must be a string.
    const out = await runTool(db, 'count_dishes_eaten', { dishQuery: 123 });
    expect(out).toHaveProperty('error');
  });

  it('exposes JSON-schema tool specs for the chat API', () => {
    const specs = toolSpecs();
    expect(specs).toHaveLength(ASSISTANT_TOOLS.length);
    const countTool = specs.find((s) => s.function.name === 'count_dishes_eaten');
    expect(countTool?.function.parameters).toMatchObject({ type: 'object' });
  });
});
