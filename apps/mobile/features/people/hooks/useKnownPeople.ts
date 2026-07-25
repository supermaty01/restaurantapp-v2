import { useEffect, useState } from 'react';

import { useDatabase } from '@/lib/hooks/useDatabase';

import { listKnownPeople, type PersonDTO } from '../repositories/peopleRepository';

/**
 * People this diary has tagged before, most recent first.
 *
 * Read once per mount rather than live: the list feeds a suggestion strip, and
 * a person created while the form is open is already in `value` — re-querying
 * on every keystroke would only make the strip flicker.
 */
export function useKnownPeople(): PersonDTO[] {
  const db = useDatabase();
  const [people, setPeople] = useState<PersonDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const known = await listKnownPeople(db);
        if (!cancelled) setPeople(known);
      } catch {
        // Suggestions are a convenience; the text field works without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return people;
}
