import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getTableName } from 'drizzle-orm';

import { globSync } from '@/components/__support__/glob';
import * as schema from '@/services/db/schema';

/**
 * Nadie vuelve a decirle a `useLiveTablesQuery` el nombre de una tabla.
 *
 * `addDatabaseChangeListener` informa del nombre **SQL** —`dish_tag`,
 * `visit_participant`—, y los hooks pasaban el nombre del export de Drizzle
 * —`dishTags`, `visitParticipants`—. Los dos son cadenas, así que la
 * comparación no fallaba: no coincidía nunca. Cinco hooks lo tenían mal y dos
 * lo tenían bien, con las dos ortografías conviviendo en el mismo repo.
 *
 * El precio lo pagaba quien usaba la app: poner o quitar una etiqueta a un
 * plato, o un acompañante a una visita, escribe **solo** en la tabla de unión,
 * así que la pantalla se quedaba como estaba. Y a veces sí se refrescaba
 * —cuando la operación tocaba además `dishes` o `visits`— lo que lo hacía
 * parecer intermitente en vez de roto.
 *
 * El hook ahora recibe objetos de tabla, así que el tipo ya impide escribir el
 * nombre equivocado. Esto es el cinturón sobre los tirantes: si alguien vuelve a
 * ensanchar la firma para aceptar cadenas, esta prueba lo dice antes de que
 * llegue a una pantalla.
 */
describe('el contrato de useLiveTablesQuery', () => {
  const hooks = globSync(join(__dirname, '..', '..', '..', 'features'), /\.ts$/).filter((path) =>
    readFileSync(path, 'utf8').includes('useLiveTablesQuery('),
  );

  it('encuentra los hooks que lo usan', () => {
    // Un guardián sobre el guardián: si esto llegara a cero, la prueba pasaría
    // sin comprobar nada.
    expect(hooks.length).toBeGreaterThanOrEqual(10);
  });

  it('ningún hook le pasa nombres de tabla como texto', () => {
    // Los nombres prohibidos salen del propio schema, en sus dos ortografías:
    // la SQL (`dish_tag`) y la del export (`dishTags`). Así la lista no se puede
    // quedar corta cuando aparezca una tabla nueva.
    const forbidden = new Set<string>();
    for (const [exportName, table] of Object.entries(schema)) {
      forbidden.add(exportName);
      forbidden.add(getTableName(table as Parameters<typeof getTableName>[0]));
    }

    const quoted = /['"`]([a-zA-Z_][a-zA-Z_0-9]*)['"`]/g;

    const offenders = hooks.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const found: string[] = [];

      // Cada llamada, desde el nombre hasta su paréntesis de cierre. Basta con
      // contar paréntesis: dentro no hay cadenas con paréntesis sueltos.
      for (const start of [...source.matchAll(/useLiveTablesQuery\(/g)].map((m) => m.index)) {
        let depth = 0;
        let end = start;
        for (let i = start + 'useLiveTablesQuery'.length; i < source.length; i++) {
          if (source[i] === '(') depth++;
          else if (source[i] === ')' && --depth === 0) {
            end = i;
            break;
          }
        }

        const call = source.slice(start, end);
        for (const [, name] of call.matchAll(quoted)) {
          if (name !== undefined && forbidden.has(name)) found.push(`${path}: '${name}'`);
        }
      }

      return found;
    });

    expect(offenders).toEqual([]);
  });
});

/**
 * Y el porqué, en una línea comprobable: los nombres de las uniones no se
 * parecen a sus exports. Si algún día Drizzle los hiciera coincidir, este test
 * cae y el de arriba pasa a ser una precaución sin motivo — que es justo lo que
 * uno quiere saber.
 */
describe('los nombres SQL de las tablas de unión', () => {
  it('no coinciden con el nombre del export', () => {
    expect(getTableName(schema.dishTags)).toBe('dish_tag');
    expect(getTableName(schema.restaurantTags)).toBe('restaurant_tag');
    expect(getTableName(schema.dishVisits)).toBe('dish_visit');
    expect(getTableName(schema.visitParticipants)).toBe('visit_participant');
  });
});
