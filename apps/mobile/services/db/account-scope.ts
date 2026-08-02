import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import { useSyncExternalStore } from 'react';

import { getCurrentAccount, subscribeToCurrentAccount } from './account-store';

import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * De quién es cada fila, aplicado a **leer**.
 *
 * La primera mitad de esto (la columna `account_uuid`, el sellado al escribir,
 * `linkLocalData` reclamando solo huérfanas) entró con la migración 0012 y no
 * cambiaba nada de lo que se veía, a propósito. Esta es la otra mitad, y va
 * aparte porque es donde media implementación es peor que ninguna: **un filtro
 * que falte en un sitio no da ningún error, enseña el diario de otra cuenta.**
 *
 * Lo que se reportó al probarlo: «cerré sesión de una cuenta, entré con otra
 * recién creada, y seguía viendo todo». Y también «al cerrar sesión seguía
 * viendo todo», que es el mismo fallo sin la segunda cuenta.
 *
 * ## La regla
 *
 * | Estado          | Se ve                         |
 * | --------------- | ----------------------------- |
 * | Sin sesión      | `account_uuid IS NULL`        |
 * | Con la cuenta A | `account_uuid = A OR IS NULL` |
 *
 * **El `IS NULL` del segundo caso no es laxitud.** Son las filas escritas
 * mientras la sesión se recuperaba al arrancar —`getCurrentAccount()` devuelve
 * `null` en ese hueco, que está documentado y es correcto— y las que
 * `linkLocalData` va a reclamar en el siguiente push. Sin él desaparecerían de
 * la pantalla durante unos segundos en cada arranque, que se vive como perder
 * el diario.
 *
 * ## Por qué no basta con `getCurrentAccount()`
 *
 * Porque es un módulo, no es reactivo. Con solo esa función, iniciar o cerrar
 * sesión no repintaría nada: la consulta ya se lanzó con el valor de antes.
 * `useCurrentAccount()` la envuelve en `useSyncExternalStore` y **el valor tiene
 * que entrar en las `deps` de `useLiveTablesQuery`**, o la consulta no se
 * relanza y da igual todo lo demás.
 *
 * ## Y una consecuencia que hay que decir en voz alta
 *
 * Cerrar sesión pasa a vaciar la pantalla, y antes no lo hacía. Es la semántica
 * correcta —las filas quedaron selladas con la cuenta— pero es un cambio brusco,
 * y por eso el aviso al iniciar sesión con datos locales no es un extra: sin él,
 * esto se vive como pérdida de datos. Nada se ha borrado: volver a entrar con
 * esa cuenta lo devuelve entero.
 */

/**
 * La condición «esta fila es de la cuenta activa».
 *
 * Recibe la columna, no el nombre de la tabla, por lo mismo que
 * `useLiveTablesQuery` recibe tablas: una cadena mal escrita no falla, no
 * coincide.
 */
export function ownedBy(column: SQLiteColumn, account: string | null): SQL {
  // `or(...)` puede devolver undefined si no recibe condiciones; con dos
  // argumentos literales no puede, pero el tipo no lo sabe.
  return account === null ? isNull(column) : (or(eq(column, account), isNull(column)) as SQL);
}

/**
 * Añade el filtro de cuenta a lo que ya filtraba la consulta.
 *
 * Existe porque los sitios no son mecánicos y eso es lo que hace que haya que
 * hacerlo con calma: `useRestaurantList` llama a `.where()` solo si
 * `!includeDeleted`, otros lo llaman siempre, otros no lo llaman. Un
 * `find`/`replace` no vale, pero sí vale tener un único sitio donde se decide
 * cómo se combinan las dos condiciones.
 */
export function scopedTo(
  column: SQLiteColumn,
  account: string | null,
  condition?: SQL | undefined,
): SQL {
  const scope = ownedBy(column, account);
  return condition ? (and(condition, scope) as SQL) : scope;
}

/**
 * La cuenta activa, de forma que React se entere cuando cambie.
 *
 * Se pasa como dependencia a `useLiveTablesQuery` en todos los sitios donde se
 * usa; `account-scope.node.test.ts` comprueba que así sea.
 */
export function useCurrentAccount(): string | null {
  return useSyncExternalStore(subscribeToCurrentAccount, getCurrentAccount, getCurrentAccount);
}
