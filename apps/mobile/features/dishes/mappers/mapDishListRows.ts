import { imagePathToUri } from '@/lib/helpers/image-paths';

import { DishListDTO } from '../types/dish-dto';

export interface DishListRow {
  dishId: number | null;
  dishName: string | null;
  dishComments: string | null;
  dishRating: number | null;
  dishDeleted?: boolean | null;
  tagId?: number | null;
  tagName?: string | null;
  tagColor?: string | null;
  tagDeleted?: boolean | null;
  imageId?: number | null;
  imagePath?: string | null;
}

export function mapDishListRows(rows: DishListRow[]): DishListDTO[] {
  const map = new Map<number, DishListDTO>();

  for (const row of rows) {
    if (!row.dishId) continue;

    let dish = map.get(row.dishId);

    if (!dish) {
      dish = {
        id: row.dishId,
        name: row.dishName ?? '',
        comments: row.dishComments ?? null,
        rating: row.dishRating ?? null,
        deleted: row.dishDeleted ?? undefined,
        tags: [],
        images: [],
      };
      map.set(row.dishId, dish);
    }

    if (row.tagId && row.tagName && row.tagColor && !dish.tags.some((tag) => tag.id === row.tagId)) {
      dish.tags.push({
        id: row.tagId,
        name: row.tagName,
        color: row.tagColor,
        deleted: row.tagDeleted ?? undefined,
      });
    }

    if (row.imageId && row.imagePath && !dish.images.some((image) => image.id === row.imageId)) {
      dish.images.push({
        id: row.imageId,
        uri: imagePathToUri(row.imagePath),
      });
    }
  }

  return Array.from(map.values());
}
