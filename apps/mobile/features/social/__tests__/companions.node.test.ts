import { companionsLabel } from '../companions';

describe('con quién fue', () => {
  it('nadie no dice nada', () => {
    expect(companionsLabel([], 0)).toBeNull();
  });

  it('una persona, por su nombre', () => {
    expect(companionsLabel(['Irene'], 1)).toBe('con Irene');
  });

  it('dos se leen como una frase', () => {
    expect(companionsLabel(['Irene', 'Moni'], 2)).toBe('con Irene y Moni');
  });

  it('a partir de tres, los dos primeros y el resto cuenta', () => {
    expect(companionsLabel(['Irene', 'Moni', 'Caro', 'Ana'], 4)).toBe('con Irene, Moni y 2 más');
  });

  /*
   * Una visita anterior a 0018 llega con el conteo pero sin nombres, y también
   * llegaría así si a alguien le borraran el nombre de la libreta. Caer al
   * conteo es peor que los nombres y mucho mejor que una tarjeta que de repente
   * deja de decir que había gente.
   */
  it('sin nombres, cae al conteo en vez de callarse', () => {
    expect(companionsLabel([], 2)).toBe('con 2 personas');
    expect(companionsLabel([], 1)).toBe('con 1 persona');
  });

  it('un nombre en blanco no cuenta como nombre', () => {
    expect(companionsLabel(['  '], 1)).toBe('con 1 persona');
  });
});
