import { z } from "zod";

export const dishSchema = z.object({
  name: z.string().nonempty('El nombre es requerido'),
  restaurantId: z.number({
    required_error: 'Selecciona un restaurante',
  }).positive('Selecciona un restaurante'),
  comments: z.string().optional(),
  price: z.coerce.number().positive("El valor debe ser positivo").optional(),
  rating: z.number().min(1).max(5).optional(),
});

export type DishFormData = z.infer<typeof dishSchema>;