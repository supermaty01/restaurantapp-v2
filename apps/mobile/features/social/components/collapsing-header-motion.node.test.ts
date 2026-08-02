import { COLLAPSED_HEIGHT, headerOffset, headerProgress } from './collapsing-header-motion';

/**
 * Las tres frases con las que se pidió esto, convertidas en aserciones.
 *
 * > - Al iniciar a scrollear, no se debería mover aún la lista, solo reducir el
 * >   tamaño del header.
 * > - Cuando el header esté de tamaño, se retoma el control del scroll por la
 * >   lista y se comienza a bajar.
 * > - Cuando se está abajo en la lista y se scrollea para arriba, se debe
 * >   mantener el header pequeño hasta que se llegue arriba.
 *
 * Las tres salen de la misma función leída en tres tramos, y por eso están las
 * tres aquí: lo que hay que poder comprobar de un vistazo dentro de seis meses
 * es que sigue haciendo eso, no que `Math.min` funciona.
 */
const RANGE = 200;

describe('la cabecera se come el primer tramo del gesto', () => {
  it('lo que se desplaza al principio se lo lleva entero la cabecera', () => {
    // Primera frase: el desplazamiento y la subida de la cabecera van uno a uno,
    // así que la lista no pasa de largo — el bloque entero sube con ella.
    expect(headerOffset(0, RANGE)).toBe(0);
    expect(headerOffset(40, RANGE)).toBe(40);
    expect(headerOffset(120, RANGE)).toBe(120);
    expect(headerOffset(RANGE, RANGE)).toBe(RANGE);
  });

  it('pasada la cabecera, el resto es de la lista', () => {
    // Segunda frase: a partir de `range` la cabecera no se mueve más, así que
    // todo el desplazamiento que sigue lo consume la lista.
    expect(headerOffset(RANGE + 1, RANGE)).toBe(RANGE);
    expect(headerOffset(RANGE + 500, RANGE)).toBe(RANGE);
    expect(headerOffset(4000, RANGE)).toBe(RANGE);
  });

  it('subiendo desde abajo se queda pequeña hasta llegar arriba', () => {
    // Tercera frase, que es el mismo tope leído al revés: mientras quede
    // desplazamiento por encima de `range`, la cabecera sigue recogida del todo.
    for (const y of [4000, 2000, 900, RANGE + 60, RANGE + 1]) {
      expect({ y, offset: headerOffset(y, RANGE) }).toEqual({ y, offset: RANGE });
    }
    // Y solo empieza a crecer al entrar en el último tramo.
    expect(headerOffset(RANGE - 1, RANGE)).toBe(RANGE - 1);
    expect(headerOffset(0, RANGE)).toBe(0);
  });

  it('el rebote hacia arriba no la baja más de lo que mide', () => {
    // iOS deja estirar la lista por encima del tope y eso da desplazamientos
    // negativos. Sin el suelo, la cabecera bajaría más de lo que ocupa y dejaría
    // un hueco entre ella y la lista.
    expect(headerOffset(-1, RANGE)).toBe(0);
    expect(headerOffset(-300, RANGE)).toBe(0);
  });

  it('es monótona: recorrer el gesto nunca la hace retroceder', () => {
    // Lo que fallaba en la primera versión no era el valor, era que iba y venía.
    // Bajando, la cabecera solo puede recogerse; subiendo, solo desplegarse.
    let previous = -1;
    for (let y = 0; y <= 600; y += 7) {
      const offset = headerOffset(y, RANGE);
      expect(offset).toBeGreaterThanOrEqual(previous);
      previous = offset;
    }
  });
});

describe('antes de medir la ficha no se mueve nada', () => {
  it('sin rango, la cabecera se queda desplegada', () => {
    // `range` vale 0 hasta que `onLayout` contesta. Devolver otra cosa aquí
    // encogería la cabecera en el primer fotograma y daría el salto que la
    // medición existe para evitar.
    expect(headerOffset(500, 0)).toBe(0);
    expect(headerProgress(500, 0)).toBe(0);
  });

  it('y el progreso nunca sale NaN', () => {
    // En un estilo de reanimated un NaN no falla: deja la vista invisible, que
    // es de los fallos más caros de encontrar mirando una pantalla.
    for (const range of [0, -1, Number.NaN]) {
      expect(Number.isNaN(headerProgress(120, range))).toBe(false);
    }
  });
});

describe('el progreso', () => {
  it('va de 0 a 1 a lo largo del recorrido', () => {
    expect(headerProgress(0, RANGE)).toBe(0);
    expect(headerProgress(RANGE / 2, RANGE)).toBeCloseTo(0.5);
    expect(headerProgress(RANGE, RANGE)).toBe(1);
    expect(headerProgress(RANGE * 3, RANGE)).toBe(1);
  });
});

describe('la barra recogida', () => {
  it('deja sitio para una fila con la cara y el nombre', () => {
    // Un avatar de 34 más el aire de arriba y abajo. Si esto se quedara corto,
    // la barra saldría recortada en vez de encogida.
    expect(COLLAPSED_HEIGHT).toBeGreaterThanOrEqual(48);
  });
});
