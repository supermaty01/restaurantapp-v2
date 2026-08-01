import {
  DROP_STRETCH,
  pageAfterSwipe,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  thumbGeometry,
  TRACK_PADDING,
} from './segmented-tabs-motion';

/**
 * Las dos decisiones del pager del Diario.
 *
 * Se prueban aquí y no montando el componente porque **reanimated no se puede
 * importar en jest**: `react-native-worklets` busca su módulo nativo y revienta
 * al cargar, antes de llegar a ninguna prueba. Sacar la aritmética del
 * componente es lo que la deja al alcance de un test; el resto —quién escucha
 * el gesto, qué se monta— sigue necesitando un dispositivo, y está anotado como
 * tal en ESTADO.
 */
describe('a qué página se va al soltar', () => {
  const swipe = (over: Partial<Parameters<typeof pageAfterSwipe>[0]>) =>
    pageAfterSwipe({ from: 1, translationX: 0, velocityX: 0, count: 3, ...over });

  it('un arrastre corto y lento no cambia de página', () => {
    // El caso que más ocurre sin querer: rozar la pantalla mientras se lee.
    expect(swipe({ translationX: -20, velocityX: 100 })).toBe(1);
  });

  it('un arrastre largo, aunque sea lento', () => {
    expect(swipe({ translationX: -SWIPE_DISTANCE, velocityX: 0 })).toBe(2);
    expect(swipe({ translationX: SWIPE_DISTANCE, velocityX: 0 })).toBe(0);
  });

  it('un lanzamiento corto pero rápido', () => {
    // Exigir las dos cosas convierte el gesto en algo que hay que hacer con
    // ganas, y deslizar entre pestañas se hace de pasada.
    expect(swipe({ translationX: -10, velocityX: -SWIPE_VELOCITY })).toBe(2);
  });

  it('nunca se sale por los extremos', () => {
    expect(swipe({ from: 0, translationX: 300, velocityX: 2000 })).toBe(0);
    expect(swipe({ from: 2, translationX: -300, velocityX: -2000 })).toBe(2);
  });

  it('salta una sola página por gesto, por largo que sea el arrastre', () => {
    // Con tres pestañas, ir de la primera a la última sin enseñar la de en
    // medio es lo contrario de lo que un pager cuenta.
    expect(swipe({ from: 0, translationX: -900, velocityX: -3000 })).toBe(1);
  });
});

describe('la pastilla', () => {
  const TRACK = 300;
  const COUNT = 3;
  const geometry = (position: number) =>
    thumbGeometry({ position, count: COUNT, trackWidth: TRACK });
  const segment = (TRACK - TRACK_PADDING * 2) / COUNT;

  it('en reposo ocupa exactamente su segmento', () => {
    for (const index of [0, 1, 2]) {
      const { left, width } = geometry(index);
      expect(width).toBeCloseTo(segment);
      expect(left).toBeCloseTo(TRACK_PADDING + index * segment);
    }
  });

  it('se estira a mitad de camino: el efecto gota', () => {
    // Si no se estirase, esto sería igual que en reposo — que es exactamente
    // como se veía antes, porque no había una pastilla que se moviera.
    expect(geometry(0.5).width).toBeCloseTo(segment * DROP_STRETCH);
    expect(geometry(0.5).width).toBeGreaterThan(geometry(0).width);
  });

  it('el estirón crece hacia los dos lados, no solo hacia la derecha', () => {
    const rest = geometry(0);
    const stretched = geometry(0.5);
    // Su centro está a mitad de camino entre los dos segmentos…
    expect(stretched.left + stretched.width / 2).toBeCloseTo(
      rest.left + rest.width / 2 + segment / 2,
    );
    // …y el borde izquierdo ha retrocedido, que es lo que hace la corrección.
    expect(stretched.left).toBeLessThan(rest.left + segment / 2);
  });

  it('no se sale del carril ni en el último segmento', () => {
    // Sin el tope, el estirón en el borde derecho asomaba por fuera del fondo.
    for (const position of [-1, 0, 1.5, 2, 5]) {
      const { left, width } = geometry(position);
      expect(left).toBeGreaterThanOrEqual(TRACK_PADDING - 0.001);
      expect(left + width).toBeLessThanOrEqual(TRACK - TRACK_PADDING + 0.001);
    }
  });
});
