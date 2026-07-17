import { ImageDTO } from "@/features/images/types/image-dto";
import { TagDTO } from "@/features/tags/types/tag-dto";

export interface DishDetailsDTO {
  id: number;
  name: string;
  comments: string | null;
  restaurant: {
    id: number;
    name: string;
    deleted?: boolean;
  };
  price: number | null;
  rating: number | null;
  deleted?: boolean;
  tags: TagDTO[];
  images: ImageDTO[];
}

export interface DishListDTO {
  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  deleted?: boolean;
  tags: TagDTO[];
  images: ImageDTO[];
}
