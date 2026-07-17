import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import * as schema from '@/services/db/schema';

import { TagDTO } from '../types/tag-dto';

export const useTagsList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });

  const query = drizzleDb.select().from(schema.tags);

  if (!includeDeleted) {
    query.where(eq(schema.tags.deleted, false));
  }

  const { data: rawData } = useLiveTablesQuery(query, ['tags'], [includeDeleted]);

  return (
    rawData?.map<TagDTO>((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      deleted: row.deleted,
    })) ?? []
  );
};