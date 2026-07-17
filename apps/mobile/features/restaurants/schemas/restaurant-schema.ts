import { z } from "zod";

export const restaurantSchema = z.object({
  name: z.string().nonempty('El nombre es requerido'),
  comments: z.string().optional().nullable(),
  rating: z.number().min(1).max(5).optional().nullable(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional().nullable(),
});

export type RestaurantFormData = z.infer<typeof restaurantSchema>;