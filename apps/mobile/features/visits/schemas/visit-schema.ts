import { z } from "zod";

export const visitSchema = z.object({
  visited_at: z.string().nonempty('La fecha de la visita es requerida'),
  comments: z.string().optional(),
  restaurantId: z.number({
    required_error: 'Selecciona un restaurante',
  }).positive('Selecciona un restaurante'),
  dishes: z.array(z.number({
    required_error: 'Debes seleccionar al menos un plato',
  })).min(1, 'Debes seleccionar al menos un plato').or(z.array(z.string({
    required_error: 'Debes seleccionar al menos un plato',
  })).min(1, 'Debes seleccionar al menos un plato')),
});

export type VisitFormData = z.infer<typeof visitSchema>;
