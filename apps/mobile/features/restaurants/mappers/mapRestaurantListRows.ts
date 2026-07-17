import { imagePathToUri } from '@/lib/helpers/image-paths';

import { RestaurantListDTO } from '../types/restaurant-dto';

export interface RestaurantListRow {
  restaurantId: number;
  restaurantName: string;
  restaurantComments: string | null;
  restaurantRating: number | null;
  restaurantDeleted: boolean | null;
  tagId: number | null;
  tagName: string | null;
  tagColor: string | null;
  imageId: number | null;
  imagePath: string | null;
}

export function mapRestaurantListRows(rows: RestaurantListRow[]): RestaurantListDTO[] {
  const map = new Map<number, RestaurantListDTO>();

  for (const row of rows) {
    let restaurant = map.get(row.restaurantId);

    if (!restaurant) {
      restaurant = {
        id: row.restaurantId,
        name: row.restaurantName,
        comments: row.restaurantComments,
        rating: row.restaurantRating,
        deleted: row.restaurantDeleted ?? undefined,
        tags: [],
        images: [],
      };
      map.set(row.restaurantId, restaurant);
    }

    if (row.tagId && !restaurant.tags.some((tag) => tag.id === row.tagId)) {
      restaurant.tags.push({
        id: row.tagId,
        name: row.tagName ?? '',
        color: row.tagColor ?? '',
      });
    }

    if (row.imageId && row.imagePath && !restaurant.images.some((image) => image.id === row.imageId)) {
      restaurant.images.push({
        id: row.imageId,
        uri: imagePathToUri(row.imagePath),
      });
    }
  }

  return Array.from(map.values());
}
