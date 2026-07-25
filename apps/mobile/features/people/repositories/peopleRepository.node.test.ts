import { eq } from 'drizzle-orm';

import { makeTestDb } from '@/services/db/__tests__/test-db';
import * as schema from '@/services/db/schema';

import { findOrCreatePerson, listKnownPeople } from './peopleRepository';

const CARO = '22222222-2222-4222-8222-222222222222';

describe('people tagging', () => {
  it('treats two tags with the same account as one person', async () => {
    const { db } = makeTestDb();

    const first = await findOrCreatePerson(db, {
      name: 'Caro',
      accountUuid: CARO,
      username: 'caro1234',
    });
    // Same account, different display name — someone who renamed themselves.
    const second = await findOrCreatePerson(db, {
      name: 'Carolina',
      accountUuid: CARO,
      username: 'caro1234',
    });

    expect(second).toBe(first);

    const [person] = await db.select().from(schema.people).where(eq(schema.people.id, first));
    // The newer name wins: re-tagging is how the app learns someone changed it.
    expect(person!.name).toBe('Carolina');
  });

  it('keeps a name-only person separate from an account with the same name', async () => {
    const { db } = makeTestDb();

    // A friend called Caro, and a different Caro who does not use the app.
    const account = await findOrCreatePerson(db, { name: 'Caro', accountUuid: CARO });
    const local = await findOrCreatePerson(db, { name: 'Caro' });

    expect(local).not.toBe(account);
  });

  it('reuses a name-only person, so tagging Irene twice is one Irene', async () => {
    const { db } = makeTestDb();

    const first = await findOrCreatePerson(db, { name: 'Irene' });
    const second = await findOrCreatePerson(db, { name: '  Irene  ' });

    expect(second).toBe(first);
  });

  it('suggests people most recently tagged first', async () => {
    const { db } = makeTestDb();

    await findOrCreatePerson(db, { name: 'Irene' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await findOrCreatePerson(db, { name: 'Caro', accountUuid: CARO, username: 'caro1234' });

    const known = await listKnownPeople(db);
    expect(known[0]?.name).toBe('Caro');
    expect(known[0]?.username).toBe('caro1234');
    expect(known.map((p) => p.name)).toContain('Irene');
  });
});
