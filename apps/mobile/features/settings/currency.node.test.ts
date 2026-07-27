import {
  detectCurrency,
  FALLBACK_CURRENCY,
  formatPrice,
  isKnownCurrency,
  regionOf,
} from './currency';

describe('la moneda del diario', () => {
  describe('adivinarla desde el dispositivo', () => {
    it('mira la región, no el idioma', () => {
      // `es` a secas no dice nada: lo hablan veinte países con veinte monedas.
      expect(detectCurrency('es-CO')).toBe('COP');
      expect(detectCurrency('es-ES')).toBe('EUR');
      expect(detectCurrency('en-GB')).toBe('GBP');
      expect(detectCurrency('en-US')).toBe('USD');
    });

    it('cae al valor por defecto cuando no hay región que mirar', () => {
      // Y el valor por defecto es lo que la app hacía antes, así que nadie ve
      // un cambio al actualizar.
      expect(detectCurrency('es')).toBe(FALLBACK_CURRENCY);
      expect(detectCurrency(undefined)).toBeTruthy();
    });

    it('cae al valor por defecto con una región que no está en la tabla', () => {
      // Mejor eso que ofrecer una moneda que la lista de Ajustes no puede
      // volver a elegir después.
      expect(detectCurrency('sw-KE')).toBe(FALLBACK_CURRENCY);
      expect(isKnownCurrency(detectCurrency('sw-KE'))).toBe(true);
    });

    it('acepta el guion bajo, que es como algunos motores dan el locale', () => {
      expect(regionOf('es_CO')).toBe('CO');
      expect(regionOf('es-419')).toBeNull();
    });
  });

  describe('formatear', () => {
    it('no redondea los céntimos de una moneda que no los usa', () => {
      // El peso colombiano tiene cero decimales por defecto en `Intl`, así que
      // dejar los suyos convertía 12,50 en 13 — el mismo error que la columna
      // `real` acaba de dejar de cometer, repetido al pintarlo.
      expect(formatPrice(12.5, 'COP')).toMatch(/12[.,]5/);
    });

    it('no llena de ceros lo que no tiene decimales', () => {
      expect(formatPrice(12, 'EUR')).not.toMatch(/12[.,]00/);
    });

    it('un código que Intl no conoce no deja la pantalla en blanco', () => {
      expect(formatPrice(12, 'XXXX')).toContain('12');
    });
  });
});
