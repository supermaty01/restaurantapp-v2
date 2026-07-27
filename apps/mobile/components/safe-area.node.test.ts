import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El hueco de la barra de navegación se pone **una vez**, y en la raíz.
 *
 * Desde el SDK 57 edge-to-edge es obligatorio: la ventana llega al borde físico
 * y los tres botones del sistema se dibujan encima de la app. Sin inset
 * inferior, el último elemento de cada lista queda debajo de ellos — y sin ser
 * un error, así que nada avisa.
 *
 * El fallo simétrico es igual de fácil y se ve peor: sumarlo también en el
 * carril de pestañas o en el pie del formulario deja el doble de hueco, un
 * agujero de canvas donde debería estar el borde. Por eso esta prueba mira las
 * dos direcciones.
 *
 * Se lee el código fuente, como `no-native-alerts` y `sheet-contract`: no hay
 * forma de comprobar insets sin un dispositivo, pero sí de comprobar quién
 * dice ser el dueño de este hueco.
 *
 * Vive fuera de `app/` porque expo-router mete en el bundle todo lo que hay
 * ahí; lo vigila `app-directory.node.test.ts`, que es quien cazó el primer
 * intento de dejarlo al lado del layout.
 */
const MOBILE = join(__dirname, '..');

const read = (...parts: string[]) => readFileSync(join(MOBILE, ...parts), 'utf8');

describe('el inset inferior', () => {
  it('lo aplica el layout de (main), para todas las pantallas', () => {
    const layout = read('app', '(main)', '_layout.tsx');
    const edges = /edges=\{\[([^\]]*)\]\}/.exec(layout)?.[1] ?? '';

    expect(edges).toContain("'bottom'");
  });

  it('no lo repite el carril de pestañas', () => {
    // El carril vive dentro de ese SafeAreaView, así que su borde inferior ya
    // está por encima de la barra del sistema.
    expect(read('components', 'ui', 'FloatingTabBar.tsx')).not.toMatch(/useSafeAreaInsets/);
  });

  it('no lo repite el pie de los formularios', () => {
    // Sí usa los insets, pero solo para descontarlos del salto del teclado; lo
    // que no puede es volver a sumarlos como padding.
    const scaffold = read('components', 'ui', 'FormScaffold.tsx');

    expect(scaffold).toMatch(/opened: insets\.bottom/);
    expect(scaffold).not.toMatch(/paddingBottom:\s*insets\.bottom/);
  });

  it('las hojas y los avisos sí lo llevan: se pintan en otra ventana', () => {
    // Un `Modal` es una ventana aparte y no hereda el padding del layout. Si
    // alguien se los quita «por coherencia», vuelven a meterse bajo la barra.
    for (const file of [
      ['components', 'ui', 'Sheet.tsx'],
      ['components', 'ui', 'Toast.tsx'],
    ]) {
      expect(read(...file)).toMatch(/useSafeAreaInsets/);
    }
  });
});
