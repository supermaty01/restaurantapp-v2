import { z } from 'zod';

export const dishSchema = z.object({
  name: z.string().nonempty('El nombre es requerido'),
  restaurantId: z
    .number({
      required_error: 'Selecciona un restaurante',
    })
    .positive('Selecciona un restaurante'),
  comments: z.string().optional(),
  // Vacío tiene que llegar aquí como `undefined` y no como '': `z.coerce`
  // convierte '' en 0 y «sin precio» —el caso normal— se rechazaría con "El
  // valor debe ser positivo". Lo normaliza el campo (`FormPriceField`), que es
  // quien sabe que el usuario acaba de borrar el número.
  price: z.coerce.number().positive('El valor debe ser positivo').optional(),
  // La moneda de *este* plato. Se propone desde el ajuste general y se guarda
  // aquí: cambiar de país no puede reescribir lo que pagaste el mes pasado.
  currency: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export type DishFormData = z.infer<typeof dishSchema>;
