import { TagDTO } from '@/features/tags/types/tag-dto';

export interface PeekSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RestaurantPeekData {
  type: 'restaurant';
  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  tags: TagDTO[];
  imageUrl?: string;
}

export interface DishPeekData {
  type: 'dish';
  id: number;
  name: string;
  comments: string | null;
  rating: number | null;
  tags: TagDTO[];
  imageUrl?: string;
}

export interface VisitPeekData {
  type: 'visit';
  id: number;
  date: string;
  restaurantName: string;
  comments: string | null;
  imageUrl?: string;
}

export type PeekPreviewData = RestaurantPeekData | DishPeekData | VisitPeekData;

export interface PeekSession {
  preview: PeekPreviewData;
  sourceRect: PeekSourceRect;
  sourceBorderRadius: number;
}
