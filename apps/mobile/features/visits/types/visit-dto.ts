import type { ImageDTO } from '@/features/images/types/image-dto';
import type { PersonTag } from '@/features/people/repositories/peopleRepository';
import type { Visibility } from '@/features/privacy/visibility';
import type { RestaurantDetailsDTO } from '@/features/restaurants/types/restaurant-dto';

export interface DishBasicDTO {
  id: number;
  name: string;
  deleted: boolean;
}

export interface VisitDetailsDTO {
  /** Who can see it. Changed from the detail screen, not only the form. */
  visibility: Visibility;

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
  /** Who was there. Empty is the normal case, not a missing value. */
  people: PersonTag[];
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
