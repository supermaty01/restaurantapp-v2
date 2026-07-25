import type { ImageDTO } from '@/features/images/types/image-dto';
import type { Visibility } from '@/features/privacy/visibility';
import type { TagDTO } from '@/features/tags/types/tag-dto';

export interface RestaurantDetailsDTO {
  /** Who can see it. Changed from the detail screen, not only the form. */
  visibility: Visibility;

  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  tags: TagDTO[];
  images: ImageDTO[];
  latitude: number | null;
  longitude: number | null;
  deleted: boolean;
}

export interface RestaurantListDTO {
  /** Stored value, so the list can be filtered by what is shared. */
  visibility: Visibility;

  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  deleted: boolean;
  tags: TagDTO[];
  images: ImageDTO[];
}
