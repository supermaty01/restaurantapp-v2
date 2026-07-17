import { ImageDTO } from "@/features/images/types/image-dto";
import { TagDTO } from "@/features/tags/types/tag-dto";

export interface RestaurantDetailsDTO {
  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  tags: TagDTO[];
  images: ImageDTO[];
  latitude: number | null;
  longitude: number | null;
  deleted?: boolean;
}

export interface RestaurantListDTO {
  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  deleted?: boolean;
  tags: TagDTO[];
  images: ImageDTO[];
}