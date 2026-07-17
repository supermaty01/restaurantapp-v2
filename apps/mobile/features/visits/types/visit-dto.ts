import { ImageDTO } from '@/features/images/types/image-dto'
import { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';

export interface DishBasicDTO {
  id: number;
  name: string;
  deleted?: boolean;
}

export interface VisitDetailsDTO {
  id: number;
  visited_at: string;
  comments: string | null;
  deleted?: boolean;
  restaurant: {
    id: number;
    name: string;
    deleted?: boolean;
  };
  images: ImageDTO[];
  dishes: DishBasicDTO[];
}

export interface VisitListDTO {
  id: number;
  visited_at: string;
  comments: string | null;
  deleted?: boolean;
  restaurant: {
    id: number;
    name: string;
    deleted?: boolean;
  };
  images: ImageDTO[];
}

// Mantener para compatibilidad con código existente
export interface VisitDTO {
  id: string;
  visited_at: string;
  comments: string;
  restaurant: RestaurantDetailsDTO;
  images: ImageDTO[];
}
