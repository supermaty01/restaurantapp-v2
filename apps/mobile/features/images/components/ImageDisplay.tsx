import { ImageCarousel } from '@/components/media/ImageCarousel';
import type { ImageDTO } from '@/features/images/types/image-dto';

interface ImageDisplayProps {
  images: ImageDTO[];
}

export function ImageDisplay({ images }: ImageDisplayProps) {
  return <ImageCarousel images={images} />;
}
