import { getTableName, is } from 'drizzle-orm';
import { type AnySQLiteSelect, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { SQLiteRelationalQuery } from 'drizzle-orm/sqlite-core/query-builders/query';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

/**
 * Una consulta que se vuelve a lanzar cuando cambian las tablas que la componen.
 *
 * ## Por qué recibe tablas y no nombres
 *
 * `addDatabaseChangeListener` informa del nombre **SQL** de la tabla que se
 * tocó: `dish_tag`, `visit_participant`. Los hooks pasaban el nombre del export
 * de Drizzle —`dishTags`, `visitParticipants`—, que no se parece al SQL en
 * ninguna de las tablas de unión. La comparación no fallaba: simplemente no
 * coincidía nunca.
 *
 * El efecto era una pantalla que no se enteraba. Poner o quitar una etiqueta a
 * un plato, o un acompañante a una visita, escribe **solo** en la tabla de
 * unión, así que la lista se quedaba como estaba. A veces sí se refrescaba —
 * cuando la misma operación tocaba además `dishes` o `visits`, que sí estaban
 * bien escritas— y eso hacía que pareciera intermitente en lugar de roto.
 *
 * Cinco hooks lo tenían mal y dos lo tenían bien (`useHomeSummary`,
 * `useTagUsage`, que escribían `dish_visit` y `dish_tag` a mano). Un `string[]`
 * no puede distinguir esos dos casos, y ninguna herramienta del proyecto podía
 * verlo: no es un tipo, es una cadena que se compara con otra cadena.
 *
 * Por eso ahora recibe los objetos de tabla y saca el nombre con
 * `getTableName`. No es una comprobación más estricta del mismo error: es que
 * el error deja de poder escribirse. `schema.dishTags` es lo único que se puede
 * pasar, y resuelve a `dish_tag` por construcción.
 */
export const useLiveTablesQuery = <
  T extends Pick<AnySQLiteSelect, '_' | 'then'> | SQLiteRelationalQuery<'sync', unknown>,
>(
  query: T,
  /** Las tablas del schema que componen la consulta, no sus nombres. */
  tables: SQLiteTable[],
  deps: unknown[] = [],
) => {
  const [data, setData] = useState<Awaited<T>>(
    // `mode` no está en el tipo público de SQLiteRelationalQuery, pero es lo que
    // distingue una consulta de una fila de una de muchas: sin esto, un `first`
    // arranca con `[]` y el consumidor lee `.length` de algo que iba a ser un
    // objeto.
    // @ts-expect-error -- `mode` es interno de drizzle
    (is(query, SQLiteRelationalQuery) && query.mode === 'first' ? undefined : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  // Los nombres SQL, que es lo único con lo que se puede comparar el evento.
  // Sin `useMemo`: `tables` es un literal nuevo en cada render, así que
  // memorizar contra él no ahorraría nada. Lo que se compara es `tableKey`.
  const names = tables.map(getTableName);
  const tableKey = names.join('|');
  const depsKey = JSON.stringify(deps);

  // La consulta y las tablas más recientes, para que el listener no capture las
  // del render en el que se suscribió. Se sincronizan en un efecto propio, y
  // este va declarado antes a propósito: en el montaje los efectos corren en
  // orden, y el de abajo lee estas referencias.
  const queryRef = useRef(query);
  const namesRef = useRef(names);
  useEffect(() => {
    queryRef.current = query;
    namesRef.current = names;
  });

  useEffect(() => {
    // The query's `then` is an intersection of two drizzle thenables, so its
    // callback parameter is only expressible as `unknown`; the resolved value
    // is `Awaited<T>` by construction.
    const handleData = (result: unknown) => {
      setData(result as Awaited<T>);
      setError(undefined);
      setUpdatedAt(new Date());
    };

    const run = () => {
      queryRef.current.then(handleData).catch(setError);
    };

    run();

    /**
     * Un sync escribe fila a fila, así que una página de quinientos registros
     * dispara quinientos eventos sobre las mismas tablas. Relanzar la consulta
     * en cada uno es repetir el mismo trabajo quinientas veces para pintar
     * cuatrocientos noventa y nueve resultados que nadie llega a ver.
     *
     * Se agrupa en un turno del bucle de eventos: llegue un cambio o mil, se
     * consulta una vez cuando la ráfaga para. Sin retardo fijo, para que un
     * cambio suelto —lo que hace una persona escribiendo— siga siendo inmediato.
     */
    let pending: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = undefined;
        run();
      }, 0);
    };

    const listener = addDatabaseChangeListener(({ tableName }) => {
      if (namesRef.current.includes(tableName)) schedule();
    });

    return () => {
      if (pending) clearTimeout(pending);
      listener.remove();
    };
  }, [depsKey, tableKey]);

  return {
    data,
    error,
    updatedAt,
  } as const;
};
