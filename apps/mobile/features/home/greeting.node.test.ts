import { greeting, prompt } from './greeting';

/**
 * Las veinticuatro horas de un tirón.
 *
 * El fallo que motiva esto no se veía leyendo el código: había que estar
 * mirando la app a las 11:30 para ver que preguntaba «¿qué comiste hoy?» antes
 * de comer. Una regla con franjas se equivoca **en los bordes**, y los bordes
 * son baratos de recorrer aquí y caros de pillar en un móvil.
 */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

describe('el saludo', () => {
  it('saluda en las cuatro horas de referencia', () => {
    expect(greeting(3)).toBe('Buenas noches');
    expect(greeting(9)).toBe('Buenos días');
    expect(greeting(15)).toBe('Buenas tardes');
    expect(greeting(22)).toBe('Buenas noches');
  });

  it('dice algo a cualquier hora', () => {
    for (const hour of HOURS) {
      expect(greeting(hour)).not.toBe('');
    }
  });

  it('aguanta una hora imposible sin quedarse en blanco', () => {
    // `new Date().getHours()` no devuelve nada raro, pero un saludo vacío en la
    // primera línea de la pantalla de inicio es un fallo muy visible por algo
    // que no cuesta nada blindar.
    expect(greeting(-1)).toBe(greeting(0));
    expect(greeting(99)).toBe(greeting(23));
    expect(greeting(Number.NaN)).not.toBe('');
  });
});

describe('la pregunta', () => {
  it('no pregunta por la comida antes de comer', () => {
    // La franja que fallaba: a las 11 y a las 12 la app daba por hecho que ya
    // habías comido. Ahora, hasta la una, mira adelante.
    for (const hour of [11, 12]) {
      expect(prompt(hour)).not.toContain('comiste');
    }
    expect(prompt(12)).toContain('Comes fuera');
  });

  it('no pregunta por la cena a media tarde', () => {
    // El otro borde: a las 17 preguntaba «¿dónde has cenado?», tres horas antes
    // de que nadie cene.
    for (const hour of [17, 18, 19]) {
      expect(prompt(hour)).not.toContain('cenado');
    }
  });

  it('pregunta por cada comida cuando toca', () => {
    expect(prompt(9)).toContain('Desayunaste');
    expect(prompt(14)).toContain('comiste');
    expect(prompt(21)).toContain('cenado');
  });

  it('en la madrugada la cena ya pasó', () => {
    // A las tres de la mañana lo que se apunta es lo de anoche, no lo de esta
    // noche: es el mismo error de tiempo verbal con el reloj al otro lado.
    expect(prompt(3)).toContain('anoche');
  });

  it('pregunta algo a cualquier hora, y siempre en dos líneas', () => {
    for (const hour of HOURS) {
      const text = prompt(hour);
      expect(text).not.toBe('');
      // El titular está compuesto para dos líneas: una sola larga se parte por
      // donde quiera el ancho de la pantalla y descuadra el bloque.
      expect(text.split('\n')).toHaveLength(2);
    }
  });
});
