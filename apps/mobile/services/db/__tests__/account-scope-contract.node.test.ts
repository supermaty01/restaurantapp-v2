import { readFileSync } from 'node:fs';
import { join, relative as relativeTo } from 'node:path';

import { globSync } from '@/components/__support__/glob';

/**
 * Que **ningún** hook de lista lea el diario sin filtrar por cuenta.
 *
 * Este test se escribió antes que el filtro y se vio fallar, que es el idioma de
 * `live-tables-contract.node.test.ts` y existe por el mismo motivo: un filtro
 * que falte en un sitio **no da ningún error**. La pantalla se pinta, la
 * consulta funciona, y lo que enseña es el diario de otra cuenta. Es
 * exactamente lo que se reportó al probar dos cuentas en el mismo móvil —
 * «cerré sesión de una, entré con la otra recién creada, y seguía viendo todo».
 *
 * No basta con filtrar: la cuenta **tiene que entrar en las `deps`** de
 * `useLiveTablesQuery`. Sin eso la consulta no se relanza al cambiar de sesión,
 * así que la primera pantalla que ya estuviera montada seguiría enseñando lo de
 * antes. Los dos requisitos se comprueban por separado porque fallan por
 * separado.
 *
 * ## El guardián sobre el guardián
 *
 * Un test que lee ficheros pasa alegremente cuando no encuentra ninguno. Por eso
 * lo primero que comprueba es que encontró los trece hooks que hay: si alguien
 * mueve el directorio, esto falla en vez de dar vía libre.
 */

const root = join(__dirname, '..', '..', '..');

/** Los hooks que leen el diario. Se descubren, no se listan a mano. */
const hookFiles = globSync(join(root, 'features'), /\.ts$/)
  .map((path) => ({
    relative: relativeTo(root, path).replace(/\\/g, '/'),
    source: readFileSync(path, 'utf8'),
  }))
  .filter(({ source }) => source.includes('useLiveTablesQuery('));

describe('el filtro de cuenta está en todas las lecturas', () => {
  it('encontró los hooks que tiene que revisar', () => {
    // Trece cuando esto se escribió. El listón es «no menos», no «exactamente»:
    // un hook nuevo tiene que sumar, no romper el test por existir.
    expect(hookFiles.length).toBeGreaterThanOrEqual(13);
  });

  it.each(hookFiles.map(({ relative }) => relative))('%s pide la cuenta activa', (relative) => {
    const entry = hookFiles.find((file) => file.relative === relative);
    expect(entry?.source).toContain('useCurrentAccount()');
  });

  it.each(hookFiles.map(({ relative }) => relative))('%s filtra por account_uuid', (relative) => {
    const entry = hookFiles.find((file) => file.relative === relative);
    // `scopedTo` para las consultas que ya filtraban por algo, `ownedBy` para
    // las que no filtraban por nada. Las dos salen de `account-scope.ts`.
    expect(entry?.source).toMatch(/\b(scopedTo|ownedBy)\(/);
  });

  it.each(hookFiles.map(({ relative }) => relative))(
    '%s mete la cuenta en las deps, o la consulta no se relanza',
    (relative) => {
      const entry = hookFiles.find((file) => file.relative === relative);
      const source = entry?.source ?? '';

      // Cada llamada a `useLiveTablesQuery` lleva su propio array de deps, y
      // basta con que a una le falte para que esa lista se quede congelada con
      // el diario de la sesión anterior.
      const calls = source.split('useLiveTablesQuery(').slice(1);
      expect(calls.length).toBeGreaterThan(0);

      for (const call of calls) {
        // El tercer argumento: lo que hay entre el cierre del array de tablas y
        // el cierre de la llamada.
        const deps = call.slice(call.indexOf(']') + 1);
        const upToCallEnd = deps.slice(0, deps.indexOf(');'));
        expect({ file: relative, hasAccountDep: upToCallEnd.includes('account') }).toEqual({
          file: relative,
          hasAccountDep: true,
        });
      }
    },
  );
});

/**
 * Y que la cuenta se lea de forma reactiva.
 *
 * `getCurrentAccount()` es correcto para **escribir** —sellar una fila nueva
 * ocurre una vez, en el momento— y no sirve para leer: es un módulo, no avisa a
 * React de nada, así que iniciar o cerrar sesión no repintaría ninguna lista.
 * Un hook que lo llamara directamente compilaría, funcionaría al montar, y
 * dejaría el diario de la cuenta anterior en pantalla al cambiar de sesión.
 */
describe('los hooks no leen la cuenta del módulo', () => {
  it.each(hookFiles.map(({ relative }) => relative))(
    '%s no llama a getCurrentAccount',
    (relative) => {
      const entry = hookFiles.find((file) => file.relative === relative);
      expect(entry?.source).not.toContain('getCurrentAccount(');
    },
  );
});
