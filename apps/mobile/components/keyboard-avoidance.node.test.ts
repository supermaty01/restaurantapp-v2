import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from './__support__/glob';

/**
 * Nadie vuelve a usar el `KeyboardAvoidingView` de React Native.
 *
 * En Android no hace nada útil desde que edge-to-edge es obligatorio (SDK 57):
 * sin `behavior` pinta un `View` y confía en que la ventana se encoja sola con
 * `adjustResize`, y una ventana edge-to-edge **no se encoge** — el teclado
 * llega como inset. Con `behavior="padding"` tampoco vale, porque calcula la
 * altura a partir del `screenY` que el core deriva de
 * `getWindowVisibleDisplayFrame`, que en edge-to-edge tampoco se mueve.
 *
 * El síntoma no es un error: es un teclado sentado encima del último campo y
 * ninguna forma de hacer scroll para sacarlo de ahí, porque no hay nada
 * desbordado. Ya costó una ronda entera, con un arreglo que parecía razonable
 * —meter la pantalla en `FormScaffold`— y no cambió nada.
 *
 * Lo que sí funciona vive en `FormScaffold`, sobre
 * `react-native-keyboard-controller`, que lee los insets de la IME.
 *
 * Se comprueba el import y no el nombre suelto para que este mismo fichero, que
 * lo nombra en la explicación, no se acuse a sí mismo.
 */
const CORE_IMPORT =
  /import\s*\{[^}]*\bKeyboardAvoidingView\b[^}]*\}\s*from\s*['"]react-native['"]/s;

describe('el KeyboardAvoidingView del core', () => {
  const files = globSync(join(__dirname, '..'), /\.tsx?$/).filter(
    (path) => !path.includes('node_modules'),
  );

  it('encuentra ficheros que revisar', () => {
    // Un guardián sobre el guardián: si esto llegara a cero, la prueba pasaría
    // sin comprobar nada.
    expect(files.length).toBeGreaterThan(50);
  });

  it('no se importa en ninguna parte', () => {
    const offenders = files.filter((path) => CORE_IMPORT.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('el scaffold sigue siendo quien esquiva el teclado', () => {
    // Si alguien deja de usar la librería en el único sitio que la usa, el test
    // de arriba pasaría con la app rota otra vez.
    const scaffold = readFileSync(join(__dirname, 'ui', 'FormScaffold.tsx'), 'utf8');
    expect(scaffold).toMatch(/from 'react-native-keyboard-controller'/);
  });
});
