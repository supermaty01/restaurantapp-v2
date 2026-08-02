import { readFileSync } from 'node:fs';
import { join, relative as relativeTo } from 'node:path';

import { globSync } from '@/components/__support__/glob';

/**
 * Que ninguna pantalla salga con el nombre de su fichero por título.
 *
 * El `Stack` de `(main)` pinta `options.title ?? route.name`, así que una ruta
 * que no esté registrada **no se queda sin título**: sale con el suyo interno.
 * En pantalla eso es una cabecera que dice `shared/dish/[id]`.
 *
 * Y no falla en ningún sitio: la pantalla navega, funciona y se ve casi bien.
 * Solo se descubre abriéndola y mirando la línea de arriba — que es exactamente
 * cómo se descubrió, dos veces. La primera dejó un comentario avisando en el
 * propio layout; la segunda añadió dos pantallas hermanas justo debajo de ese
 * comentario sin registrarlas. Un aviso escrito no es un guardián.
 *
 * Hay dos formas legítimas de estar registrada, y las dos valen:
 *
 * - con `title`, para las pantallas que usan la cabecera de la app;
 * - con `headerShown: false`, para las que traen la suya —las tres de contenido
 *   compartido, que además dicen de quién es lo que estás mirando—.
 *
 * Lo que no vale es no estar.
 */

/*
 * Vive en `lib/__tests__` y no junto a las rutas, y el porqué lo enseñó el
 * propio repositorio: la primera versión estaba en `app/__tests__/`, y
 * `app-directory.node.test.ts` la rechazó. En `app/` **todo fichero es una
 * ruta**, así que un test ahí dentro es una pantalla más. El guardián de al
 * lado cazó al guardián nuevo.
 */
const mainDir = join(__dirname, '..', '..', 'app', '(main)');

/** `…/app/(main)/shared/dish/[id].tsx` → `shared/dish/[id]` */
function routeNameOf(path: string): string {
  return relativeTo(mainDir, path)
    .replace(/\\/g, '/')
    .replace(/\.tsx$/, '');
}

const routes = globSync(mainDir, /\.tsx$/)
  .map(routeNameOf)
  // `_layout` no es una ruta, y las pestañas llevan sus propias cabeceras: el
  // grupo entero está registrado con `headerShown: false`.
  .filter((name) => !name.includes('_layout') && !name.startsWith('(tabs)'))
  .sort();

const layout = readFileSync(join(mainDir, '_layout.tsx'), 'utf8');

/** Los `name=` de los `<Stack.Screen>` del layout. */
const declared = new Set([...layout.matchAll(/name="([^"]+)"/g)].map(([, name]) => name as string));

describe('las pantallas de (main) están registradas en el Stack', () => {
  it('encontró las rutas que tiene que revisar', () => {
    // Un guardián sobre el guardián: si el directorio se moviera, esto pasaría
    // sin comprobar ni una pantalla.
    expect(routes.length).toBeGreaterThanOrEqual(20);
    expect(routes).toContain('shared/dish/[id]');
  });

  it.each(routes)('%s tiene su <Stack.Screen>', (route) => {
    expect({ route, declarada: declared.has(route) }).toEqual({ route, declarada: true });
  });

  it('las de contenido ajeno esconden la cabecera de la app', () => {
    // Traen la suya, con el rótulo que dice qué se está mirando. Si alguna
    // dejara de esconderla saldrían dos cabeceras, una encima de otra.
    for (const route of routes.filter((name) => name.startsWith('shared/'))) {
      const declaration = layout.slice(layout.indexOf(`name="${route}"`));
      const options = declaration.slice(0, declaration.indexOf('/>'));
      expect({ route, sinCabecera: options.includes('headerShown: false') }).toEqual({
        route,
        sinCabecera: true,
      });
    }
  });
});
