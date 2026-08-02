import {
  COLLAPSE_AT,
  COLLAPSED_HEIGHT,
  EXPAND_AT,
  shouldCollapse,
} from './collapsing-header-motion';

/**
 * El parpadeo de la cabecera del perfil, convertido en aserciones.
 *
 * El síntoma reportado fue «hay dos eventos que se activan a la vez mientras
 * scrolleo y la sección de arriba se recorta/agranda todo el tiempo». No eran
 * dos eventos: era uno dando vueltas entre el layout y el gesto, porque la
 * altura de la cabecera salía del desplazamiento y el desplazamiento acababa
 * saliendo de la altura.
 *
 * Lo que se prueba aquí es lo que corta ese lazo. Y se prueba porque **es
 * exactamente la clase de arreglo que se deshace sin querer**: los dos umbrales
 * distintos parecen un descuido y unificarlos parece una limpieza.
 */

/** Una lista larga: le sobra recorrido para devolverle sitio a la cabecera. */
const ROOMY = { range: 220, scrollable: 1400 };

describe('shouldCollapse', () => {
  it('no se recoge nada más empezar a bajar', () => {
    expect(shouldCollapse(0, false, ROOMY)).toBe(false);
    expect(shouldCollapse(COLLAPSE_AT - 1, false, ROOMY)).toBe(false);
  });

  it('se recoge al pasar el umbral', () => {
    expect(shouldCollapse(COLLAPSE_AT + 1, false, ROOMY)).toBe(true);
  });

  it('sigue recogida entre los dos umbrales, subiendo o bajando', () => {
    // La histéresis, que es la mitad del arreglo: entre 40 y 96 el estado no
    // cambia, así que un recorte del desplazamiento —que es de bastante más de
    // un píxel— no puede devolverte al otro lado.
    const middle = (COLLAPSE_AT + EXPAND_AT) / 2;
    expect(shouldCollapse(middle, true, ROOMY)).toBe(true);
    expect(shouldCollapse(middle, false, ROOMY)).toBe(false);
  });

  it('solo se despliega al volver arriba del todo', () => {
    expect(shouldCollapse(EXPAND_AT + 1, true, ROOMY)).toBe(true);
    expect(shouldCollapse(EXPAND_AT - 1, true, ROOMY)).toBe(false);
    expect(shouldCollapse(0, true, ROOMY)).toBe(false);
  });

  it('los dos umbrales son distintos', () => {
    // Sin esto el resto de este fichero pasa igual y la app vuelve a parpadear:
    // con un solo umbral, la histéresis no existe y los casos de arriba se
    // convierten en el mismo caso.
    expect(EXPAND_AT).toBeLessThan(COLLAPSE_AT);
  });
});

describe('shouldCollapse: la lista tiene que poder devolver el sitio', () => {
  /**
   * La otra mitad del arreglo, y la que la histéresis sola no cubre.
   *
   * Recogerse le devuelve `range` píxeles a la lista, así que su desplazamiento
   * máximo baja en `range`. En una sección corta eso deja el máximo por debajo
   * del umbral de volver a desplegarse: Android recorta, la cabecera se
   * despliega, la lista vuelve a encoger, y otra vez. Con cuatro entradas era
   * justo el caso.
   */
  it('no se recoge si al hacerlo la lista se quedaría sin recorrido', () => {
    const tight = { range: 220, scrollable: 240 };
    expect(shouldCollapse(COLLAPSE_AT + 40, false, tight)).toBe(false);
  });

  it('tampoco justo en la frontera', () => {
    // `scrollable - range` cae exactamente en EXPAND_AT: recogerse dejaría el
    // desplazamiento máximo en el umbral, que es donde empieza a temblar.
    const edge = { range: 220, scrollable: 220 + EXPAND_AT };
    expect(shouldCollapse(COLLAPSE_AT + 40, false, edge)).toBe(false);
  });

  it('y sí en cuanto sobra un poco', () => {
    const enough = { range: 220, scrollable: 220 + EXPAND_AT + 1 };
    expect(shouldCollapse(COLLAPSE_AT + 40, false, enough)).toBe(true);
  });

  it('desplegarse no mira el sitio, porque devolver espacio no rebota', () => {
    // Al desplegarse la cabecera *quita* sitio a la lista, así que su recorrido
    // solo puede crecer. No hay nada que pueda recortarse ahí.
    const tight = { range: 220, scrollable: 0 };
    expect(shouldCollapse(EXPAND_AT + 1, true, tight)).toBe(true);
  });
});

describe('nunca se queda a medias', () => {
  it('recorrer una lista larga de arriba abajo y volver no oscila', () => {
    // La prueba que reproduce el gesto: bajar hasta el final y volver a subir
    // tiene que dar **un** cambio de estado en cada sentido, no una ristra.
    let state = false;
    let flips = 0;

    const path = [
      ...Array.from({ length: 40 }, (_, i) => i * 10),
      ...Array.from({ length: 40 }, (_, i) => 390 - i * 10),
    ];

    for (const y of path) {
      const next = shouldCollapse(y, state, ROOMY);
      if (next !== state) flips += 1;
      state = next;
    }

    expect(flips).toBe(2);
  });

  it('y en una lista corta no cambia ni una vez', () => {
    const tight = { range: 220, scrollable: 200 };
    let state = false;
    for (const y of [0, 50, 100, 150, 200, 150, 100, 50, 0]) {
      state = shouldCollapse(y, state, tight);
      expect(state).toBe(false);
    }
  });
});

describe('la barra recogida', () => {
  it('deja sitio para una fila con la cara y el nombre', () => {
    // Un avatar de 34 más el aire de arriba y abajo. Si esto se quedara corto,
    // la barra saldría recortada en vez de encogida.
    expect(COLLAPSED_HEIGHT).toBeGreaterThanOrEqual(48);
  });
});
