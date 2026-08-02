import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';

import { useLiveTablesQuery } from '@/lib/hooks/useLiveTablesQuery';
import { scopedTo, useCurrentAccount } from '@/services/db/account-scope';
import * as schema from '@/services/db/schema';

import type { TagDTO } from '../types/tag-dto';

export const useTagsList = (includeDeleted: boolean = false) => {
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const account = useCurrentAccount();

  const query = drizzleDb.select().from(schema.tags);

  query.where(
    scopedTo(
      schema.tags.accountUuid,
      account,
      includeDeleted ? undefined : eq(schema.tags.deleted, false),
    ),
  );

  const { data: rawData } = useLiveTablesQuery(query, [schema.tags], [includeDeleted, account]);

  return (
    rawData?.map<TagDTO>((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      deleted: row.deleted,
    })) ?? []
  );
};
