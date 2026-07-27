import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from './__support__/glob';

/**
 * Nadie vuelve a llamar al `Alert` de React Native.
 *
 * Dibuja el diálogo del sistema: esquinas cuadradas en Android, la tipografía
 * del sistema y su azul. Cada uno de ellos abría un agujero en el diseño, y
 * además no sabe enseñar nada que no sea título, cuerpo y botones — así que
 * «¿seguro?» y «eso ha fallado» se veían exactamente igual.
 *
 * La app tiene dos piezas para esto y la elección entre ellas es la que importa:
 * `Toast` para un resultado que no pide decisión, y `Dialog` (`ask`/`tell`) para
 * lo que sí la pide. Se sustituyeron quince llamadas repartidas en seis
 * ficheros; sin una prueba que lo sujete, la número dieciséis entra sola.
 *
 * Dos exclusiones, las dos a propósito:
 *
 * - `Dialog.tsx` documenta qué reemplaza, y nombrarlo no es usarlo.
 * - `report-error.ts` lo conserva como **último recurso**: si el
 *   `DialogProvider` no está montado —o se desmontó— no hay dónde pintar el
 *   error, y uno que no se puede enseñar es peor que uno con la tipografía
 *   equivocada. Es la única llamada que debe seguir existiendo.
 */
const ALERT_CALL = /\bAlert\.alert\s*\(/;

const ALLOWED = ['Dialog.tsx', 'report-error.ts'];

describe('el Alert nativo', () => {
  const files = globSync(join(__dirname, '..'), /\.tsx?$/).filter(
    (path) => !path.includes('node_modules') && !ALLOWED.some((allowed) => path.endsWith(allowed)),
  );

  it('encuentra ficheros que revisar', () => {
    // Un guardián sobre el guardián: si esto llegara a cero, la prueba pasaría
    // sin comprobar nada.
    expect(files.length).toBeGreaterThan(50);
  });

  it('no se usa en ninguna parte', () => {
    const offenders = files.filter((path) => ALERT_CALL.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
