import { describe, expect, it } from 'vitest';

import { escapeHtml, renderPreviewHtml, type SharePreview } from '../src/preview';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
});

describe('renderPreviewHtml', () => {
  const preview: SharePreview = {
    id: 'abc123',
    type: 'restaurant',
    title: 'Guadalupe',
    subtitle: 'El mejor de la ciudad',
    rating: 4,
  };

  it('includes OG tags and the deep link', () => {
    const html = renderPreviewHtml(preview, 'https://x.app');
    expect(html).toContain('<meta property="og:title" content="Guadalupe" />');
    expect(html).toContain('restaurantapp://import?share=abc123');
    expect(html).toContain('★★★★☆');
  });

  it('escapes a malicious title (no injection)', () => {
    const html = renderPreviewHtml(
      { ...preview, title: '<img src=x onerror=alert(1)>' },
      'https://x.app',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('uses summary_large_image only when there is an image', () => {
    expect(renderPreviewHtml(preview, 'https://x.app')).toContain(
      'name="twitter:card" content="summary"',
    );
    expect(
      renderPreviewHtml({ ...preview, imageUrl: 'https://x.app/i.jpg' }, 'https://x.app'),
    ).toContain('summary_large_image');
  });
});
