import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { globSync } from '../__support__/glob';

/**
 * Los paneles que salen desde abajo son uno solo, y su animación es una sola.
 *
 * Las dos reglas de aquí salen de fallos que ya se pagaron:
 *
 * **Uno solo.** Cada panel nuevo llegaba con su `Modal`, su fondo oscuro y su
 * esquina redondeada. Cuando se arregló que el pie no se saliera de la tarjeta,
 * el arreglo llegó a los que usaban `Sheet` y no a los demás; el de elegir tema
 * siguió además meses con una clase rota que dejaba la opción marcada sin
 * fondo, porque nadie lo miraba al tocar el resto.
 *
 * **Una sola animación.** `Sheet` tenía tres cosas moviendo la misma hoja:
 * `SlideInDown` para entrar, `SlideOutDown` para salir y un valor aparte para
 * el arrastre. De ahí el parpadeo al deslizar hacia abajo — al soltar, el gesto
 * devolvía la hoja arriba y *después* empezaba la animación de salida, así que
 * daba un salto visible antes de caer. Con `entering`/`exiting` no hay forma de
 * arreglarlo: son animaciones que React Native dispara al montar y desmontar, y
 * no saben nada de dónde dejó la hoja el dedo.
 */

const MOBILE_ROOT = join(__dirname, '..', '..');

/** Un `Modal` anclado abajo es un panel, se llame como se llame. */
const BOTTOM_ANCHORED = /justify-end|justifyContent:\s*'flex-end'/;

/**
 * Quien puede tener su propio `Modal` anclado abajo.
 *
 * Solo `Sheet`. Está aquí como lista y no como excepción implícita para que
 * añadir uno nuevo sea una decisión que alguien escribe, y no un descuido.
 */
const ALLOWED = new Set(['components/ui/Sheet.tsx']);

/**
 * Animaciones de montaje: incompatibles con arrastrar la hoja a mano.
 *
 * Se busca la prop, no el nombre de la animación, porque el nombre aparece en
 * la explicación de por qué ya no se usa — y un test que se rompe al contar su
 * propia historia es un test que se acaba borrando.
 */
const MOUNT_ANIMATIONS = /\b(entering|exiting)\s*=\s*\{/;

describe('los paneles que salen desde abajo', () => {
  const files = globSync(MOBILE_ROOT, /\.tsx$/).map((path) => ({
    path: relative(MOBILE_ROOT, path).replace(/\\/g, '/'),
    source: readFileSync(path, 'utf8'),
  }));

  it('encuentra ficheros que mirar', () => {
    // Una guarda sobre la guarda: si esto llega a cero, el suite pasaría sin
    // comprobar nada.
    expect(files.length).toBeGreaterThan(20);
  });

  it('solo Sheet monta su propio Modal pegado abajo', () => {
    const offenders = files
      .filter(({ source }) => source.includes('<Modal') && BOTTOM_ANCHORED.test(source))
      .map(({ path }) => path)
      .filter((path) => !ALLOWED.has(path));

    expect(offenders).toEqual([]);
  });

  it('Sheet no usa animaciones de montaje para la hoja', () => {
    const sheet = files.find(({ path }) => path === 'components/ui/Sheet.tsx');
    expect(sheet).toBeDefined();
    expect(MOUNT_ANIMATIONS.test(sheet?.source ?? '')).toBe(false);
  });

  it('Sheet dibuja detrás de las barras del sistema, para tocar el borde de abajo', () => {
    const sheet = files.find(({ path }) => path === 'components/ui/Sheet.tsx');
    // Sin las dos, Android mete la ventana del modal dentro de los insets y la
    // hoja se queda flotando por encima de la barra de navegación.
    expect(sheet?.source).toMatch(/\bstatusBarTranslucent\b/);
    expect(sheet?.source).toMatch(/\bnavigationBarTranslucent\b/);
  });
});
