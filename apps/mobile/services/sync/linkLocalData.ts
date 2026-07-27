import { isNull, sql } from 'drizzle-orm';

import { getCurrentAccount } from '@/services/db/account-store';
import * as schema from '@/services/db/schema';
import type { AppDatabase } from '@/services/db/types';
import { column, SYNC_TABLES } from '@/services/sync/tables';

/**
 * Enqueues every local row that has no change_log entry, so it will be pushed.
 *
 * Two jobs:
 *  - **First login**: uploads the data the user already had (docs/04).
 *  - **Self-heal**: repositories write the row and its change_log entry as
 *    separate statements — SQLite transactions can't be used here because the
 *    sync (better-sqlite3) and async (expo-sqlite) drivers disagree on async
 *    callbacks. If the app dies between the two writes, the row would never
 *    sync; running this before each push turns that into eventual consistency.
 *
 * Y un tercero desde que existe `account_uuid`: **sellar con la cuenta las
 * filas que no tienen ninguna**. Es el mismo momento y el mismo criterio —una
 * fila huérfana es la que se escribió sin sesión— así que hacerlo aquí es
 * gratis y, sobre todo, atómico con encolarla: una fila que se envía a la nube
 * de A y se queda sin sellar sería visible desde la cuenta B en el mismo móvil.
 *
 * **Solo se sella lo que no tiene dueño.** Una fila de A nunca se convierte en
 * fila de B por iniciar sesión con B: eso no es reclamar, es robar.
 *
 * One query per table (NOT EXISTS), so it is cheap enough to run on every push.
 */
export async function linkLocalData(db: AppDatabase): Promise<number> {
  let queued = 0;
  const account = getCurrentAccount();

  for (const cfg of SYNC_TABLES) {
    const idColumn = column(cfg.table, 'id');
    const uuidColumn = column(cfg.table, 'uuid');
    const accountColumn = column(cfg.table, 'accountUuid');

    // Sin sesión no hay con qué sellar, y no pasa nada: las filas se quedan
    // huérfanas hasta que alguien inicie sesión, que es justo lo que significan.
    if (account !== null) {
      await db.update(cfg.table).set({ accountUuid: account }).where(isNull(accountColumn));
    }

    const orphans = (await db
      .select({ id: idColumn, uuid: uuidColumn })
      .from(cfg.table)
      .where(
        sql`not exists (select 1 from ${schema.changeLog} where ${schema.changeLog.rowUuid} = ${uuidColumn})`,
      )) as { id: number; uuid: string }[];

    for (const row of orphans) {
      await db.insert(schema.changeLog).values({
        tableName: cfg.name,
        rowId: row.id,
        rowUuid: row.uuid,
        operation: 'insert',
      });
      queued += 1;
    }
  }

  return queued;
}
