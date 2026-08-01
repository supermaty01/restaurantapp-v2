import type { Visibility } from '@/features/privacy/visibility';
import { imagePathToUri } from '@/lib/helpers/image-paths';

import type { VisitListDTO } from '../types/visit-dto';

export interface VisitListRow {
  visitId: number | null;
  visitedAt: string | null;
  visitComments: string | null;
  visitDeleted?: boolean | null;
  visitVisibility?: Visibility | null;
  restaurantId?: number | null;
  restaurantName?: string | null;
  restaurantDeleted?: boolean | null;
  imageId?: number | null;
  imagePath?: string | null;
  imageRemoteKey?: string | null;
}

export function mapVisitListRows(rows: VisitListRow[]): VisitListDTO[] {
  const map = new Map<number, VisitListDTO>();

  for (const row of rows) {
    if (!row.visitId) continue;

    let visit = map.get(row.visitId);

    if (!visit) {
      visit = {
        id: row.visitId,
        visited_at: row.visitedAt ?? '',
        comments: row.visitComments ?? null,
        deleted: row.visitDeleted ?? false,
        visibility: row.visitVisibility ?? 'default',
        restaurant: {
          id: row.restaurantId ?? 0,
          name: row.restaurantName ?? '',
          deleted: row.restaurantDeleted ?? false,
        },
        images: [],
      };
      map.set(row.visitId, visit);
    }

    if (row.imageId && row.imagePath && !visit.images.some((image) => image.id === row.imageId)) {
      visit.images.push({
        id: row.imageId,
        uri: imagePathToUri(row.imagePath),
        remoteKey: row.imageRemoteKey ?? null,
      });
    }
  }

  return Array.from(map.values());
}
