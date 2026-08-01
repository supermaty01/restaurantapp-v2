import { z } from 'zod';

import { isKnownCurrency } from '@/features/settings/currency';

export const dishSchema = z.object({
  name: z.string().nonempty('El nombre es requerido'),
  restaurantId: z
    .number({
      required_error: 'Selecciona un restaurante',
    })
    .positive('Selecciona un restaurante'),
  comments: z.string().optional(),
  price: z.coerce.number().positive('El valor debe ser positivo').optional(),
  /**
   * La moneda del precio.
   *
   * Siempre presente en el formulario —arranca en la de Ajustes— y solo se
   * guarda si hay precio. La regla la aplica `dishWriteValues`, que es por donde
   * pasan los dos formularios: un precio sin moneda es un número sin unidad, y
   * una moneda sin precio no dice nada.
   */
  currency: z.string().refine(isKnownCurrency, 'Elige una moneda de la lista'),
  rating: z.number().min(1).max(5).optional(),
});

export type DishFormData = z.infer<typeof dishSchema>;

/**
 * Precio y moneda, siempre coherentes, para lo que se escribe en la base.
 *
 * Existe para que la regla se aplique **una vez** y no dos: los dos formularios
 * —crear y editar— construyen el mismo payload, y cuando cada uno lo hacía por
 * su cuenta era cuestión de tiempo que uno de los dos guardara una moneda
 * huérfana. Un plato al que le quitas el precio tiene que quedarse sin moneda,
 * no con la última que tuvo.
 */
export function dishWriteValues(data: DishFormData): {
  price: number | null;
  currency: string | null;
} {
  const price = data.price || null;
  return { price, currency: price === null ? null : data.currency };
}
