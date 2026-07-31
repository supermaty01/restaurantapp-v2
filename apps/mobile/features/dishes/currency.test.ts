import { formatPrice, guessLegacyCurrency, pairPriceAndCurrency } from './currency';

describe('la moneda de un precio', () => {
  it('pone el símbolo de la moneda que lleva el plato', () => {
    expect(formatPrice(12, 'EUR')).toContain('€');
    expect(formatPrice(18000, 'COP')).toContain('$');
  });

  /**
   * Un precio etiquetado con la moneda equivocada miente con más convicción que
   * uno sin etiquetar, y hay filas anteriores a la columna que pueden no
   * tenerla.
   */
  it('sin moneda enseña el número pelado, no una inventada', () => {
    const formatted = formatPrice(12, null);
    expect(formatted).not.toContain('€');
    expect(formatted).not.toContain('$');
  });

  it('sin precio no enseña nada', () => {
    expect(formatPrice(null, 'EUR')).toBeNull();
  });

  it('una moneda desconocida no rompe el formateo', () => {
    expect(formatPrice(10, 'XYZ')).toBe('10');
  });
});

describe('lo que se supone de un precio ya escrito', () => {
  // La app solo se ha usado en Colombia y en Europa, y las dos escalas no se
  // solapan: el propio número dice de dónde viene.
  it('menos de mil es Europa', () => {
    expect(guessLegacyCurrency(12)).toBe('EUR');
    expect(guessLegacyCurrency(999)).toBe('EUR');
  });

  it('de mil en adelante es Colombia', () => {
    expect(guessLegacyCurrency(1000)).toBe('COP');
    expect(guessLegacyCurrency(18000)).toBe('COP');
  });

  it('sin precio no se supone nada', () => {
    expect(guessLegacyCurrency(null)).toBeNull();
  });
});

describe('precio y moneda van juntos o no van', () => {
  it('sin precio se descarta también la moneda', () => {
    expect(pairPriceAndCurrency(undefined, 'EUR', 'COP')).toEqual({ price: null, currency: null });
  });

  it('con precio y sin elegir moneda, manda el ajuste general', () => {
    expect(pairPriceAndCurrency(12, undefined, 'COP')).toEqual({ price: 12, currency: 'COP' });
  });

  it('una moneda que no existe cae al ajuste, no se guarda', () => {
    expect(pairPriceAndCurrency(12, 'XYZ', 'EUR')).toEqual({ price: 12, currency: 'EUR' });
  });

  it('la elegida gana al ajuste', () => {
    expect(pairPriceAndCurrency(12, 'EUR', 'COP')).toEqual({ price: 12, currency: 'EUR' });
  });
});
