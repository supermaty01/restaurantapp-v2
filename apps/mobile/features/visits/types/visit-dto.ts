import type { ImageDTO } from '@/features/images/types/image-dto';
import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';

export interface DishBasicDTO {
  id: number;
  name: string;
  deleted: boolean;
}

export interface VisitDetailsDTO {
  id: number;
  /** Absent in visits imported from v1 (docs/09). */
  visited_at: string | null;
  comments: string | null;
  deleted: boolean;
  restaurant: {
    id: number;
    name: string;
    deleted: boolean;
  };
  images: ImageDTO[];
  dishes: DishBasicDTO[];
}

export interface VisitListDTO {
  id: number;
  /** Absent in visits imported from v1 (docs/09). */
  visited_at: string | null;
  comments: string | null;
  deleted: boolean;
  restaurant: {
    id: number;
    name: string;
    deleted: boolean;
  };
  images: ImageDTO[];
}

// Mantener para compatibilidad con código existente
export interface VisitDTO {
  id: string;
  /** Absent in visits imported from v1 (docs/09). */
  visited_at: string | null;
  comments: string;
  restaurant: RestaurantDetailsDTO;
  images: ImageDTO[];
}
