import { currencyForLegacyPrice, dishCurrency, formatDishPrice } from './currency';

describe('la moneda de un plato', () => {
  describe('el reparto de lo que ya estaba escrito', () => {
    // Las mismas dos reglas que la migración 0013. Si alguien mueve la frontera
    // en un sitio y no en el otro, un mismo plato cambiaría de moneda según lo
    // mire desde la lista o desde la base.
    it('por debajo de mil, euros', () => {
      expect(currencyForLegacyPrice(3.5)).toBe('EUR');
      expect(currencyForLegacyPrice(999.99)).toBe('EUR');
    });

    it('de mil en adelante, pesos', () => {
      // Mil euros por un plato no existe; mil pesos por un café, todos los días.
      expect(currencyForLegacyPrice(1000)).toBe('COP');
      expect(currencyForLegacyPrice(38000)).toBe('COP');
    });
  });

  describe('qué moneda enseñar', () => {
    it('la guardada manda sobre la deducida', () => {
      // Un plato de 12 € en Bogotá es perfectamente posible, y lo que dijo quien
      // lo escribió no se reinterpreta.
      expect(dishCurrency(12, 'COP')).toBe('COP');
      expect(dishCurrency(38000, 'EUR')).toBe('EUR');
    });

    it('sin moneda guardada, se deduce del número', () => {
      // Es el caso de una fila que llega por sync desde un móvil con la versión
      // anterior: sin esto se pintaría con la moneda de quien mira.
      expect(dishCurrency(12, null)).toBe('EUR');
      expect(dishCurrency(38000, null)).toBe('COP');
    });

    it('una moneda que la app no conoce se ignora', () => {
      expect(dishCurrency(12, 'XYZ')).toBe('EUR');
    });

    it('sin precio no hay moneda', () => {
      // Una moneda sin precio sería decorar un dato que no existe.
      expect(dishCurrency(null, 'EUR')).toBeNull();
      expect(formatDishPrice(null, 'EUR')).toBeNull();
    });
  });

  it('formatea con el símbolo de la moneda del plato, no con la de los ajustes', () => {
    // El fallo que la columna vino a arreglar: el mismo número en dos monedas.
    expect(formatDishPrice(12, 'EUR')).toContain('12');
    expect(formatDishPrice(12, 'EUR')).not.toBe(formatDishPrice(12, 'COP'));
  });
});
