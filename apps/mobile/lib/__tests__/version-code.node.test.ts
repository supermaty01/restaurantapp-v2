import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El `versionCode` solo puede subir.
 *
 * Android se niega a instalar encima de una app un APK con un `versionCode`
 * menor o igual, y lo dice con «App not installed», que no menciona ni versiones
 * ni números. Es el error que impidió actualizar desde la v1 y que se diagnosticó
 * mal una vez: el comentario de `app.config.js` afirmaba que la v1.3 había
 * salido con 1 —así que subir a 2 bastaba— y había salido con **6**.
 *
 * De ahí el número de abajo, y de ahí que esto sea un test y no otro comentario:
 * un comentario que afirma un número ya falló una vez, y nada lo sujetaba.
 *
 * Se comprobó contra el histórico del propio proyecto de EAS:
 *
 * ```bash
 * eas build:list --platform android --limit 25
 * ```
 *
 * v1.1.0 y v1.2.x salieron con 5, la v1.3.0 con 6. **Al publicar una build
 * nueva, este suelo sube con ella.**
 */
const SHIPPED = { versionCode: 6, version: '1.3.0', checkedOn: '2026-07-27' };

const CONFIG = join(__dirname, '..', '..', 'app.config.js');

describe('el versionCode de Android', () => {
  const source = readFileSync(CONFIG, 'utf8');

  it('está declarado como un número, no calculado', () => {
    // Un guardián sobre el guardián: si la constante cambia de forma, lo que
    // sigue dejaría de leer nada y pasaría sin comprobar.
    expect(source).toMatch(/const VERSION_CODE = \d+;/);
  });

  it('es mayor que el de la última versión repartida', () => {
    const declared = Number(/const VERSION_CODE = (\d+);/.exec(source)?.[1]);

    expect(declared).toBeGreaterThan(SHIPPED.versionCode);
  });

  it('la app lo usa de verdad', () => {
    // Declararlo y no pasarlo a `android.versionCode` deja a Expo poniendo 1
    // por defecto, que es exactamente donde empezó todo esto.
    expect(source).toMatch(/versionCode:\s*VERSION_CODE/);
  });
});
