import { is } from "drizzle-orm";
import { type AnySQLiteSelect } from "drizzle-orm/sqlite-core";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";

export const useLiveTablesQuery = <
  T extends
    | Pick<AnySQLiteSelect, "_" | "then">
    | SQLiteRelationalQuery<"sync", unknown>,
>(
  query: T,
  tables: string[],
  deps: unknown[] = [],
) => {
  const [data, setData] = useState<Awaited<T>>(
    // @ts-ignore
    (is(query, SQLiteRelationalQuery) && query.mode === "first"
      ? undefined
      : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const tableKey = tables.join("|");
  const depsKey = JSON.stringify(deps);
  const queryRef = useRef(query);
  const tablesRef = useRef(tables);

  useEffect(() => {
    queryRef.current = query;
    tablesRef.current = tables;
  }, [query, tableKey, tables]);

  useEffect(() => {
    let listener: ReturnType<typeof addDatabaseChangeListener> | undefined;

    const handleData = (data: any) => {
      setData(data);
      setError(undefined);
      setUpdatedAt(new Date());
    };

    queryRef.current.then(handleData).catch(setError);

    listener = addDatabaseChangeListener(({ tableName }) => {
      if (tablesRef.current.includes(tableName)) {
        queryRef.current.then(handleData).catch(setError);
      }
    });

    return () => {
      listener?.remove();
    };
  }, [depsKey, tableKey]);

  return {
    data,
    error,
    updatedAt,
  } as const;
};