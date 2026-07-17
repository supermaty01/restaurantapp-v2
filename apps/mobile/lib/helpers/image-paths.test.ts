import { imagePathToUri, normalizeImagePath } from './image-paths';

describe('image-paths helpers', () => {
  it('keeps remote and data urls untouched', () => {
    expect(normalizeImagePath('https://example.com/image.jpg')).toBe(
      'https://example.com/image.jpg',
    );
    expect(normalizeImagePath('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('normalizes local file paths into the images directory', () => {
    expect(normalizeImagePath('file:///tmp/photo.jpg')).toBe('file:///documents/images/photo.jpg');
    expect(imagePathToUri('/tmp/photo.jpg')).toBe('file:///documents/images/photo.jpg');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeImagePath('')).toBe('');
  });
});
