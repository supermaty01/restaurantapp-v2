/**
 * Server-rendered share preview (docs/05). A shared link opened without the app
 * shows this page: a nice unfurl on WhatsApp/Telegram (OG tags) and a button to
 * open in the app via deep link. Pure and dependency-free, so it's unit-tested.
 */

export interface SharePreview {
  id: string;
  type: 'restaurant' | 'dish' | 'visit';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  rating?: number;
}

/** Escapes text for safe interpolation into HTML (prevents injection). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TYPE_LABEL: Record<SharePreview['type'], string> = {
  restaurant: 'Restaurante',
  dish: 'Plato',
  visit: 'Visita',
};

export function renderPreviewHtml(preview: SharePreview, _baseUrl?: string): string {
  const title = escapeHtml(preview.title);
  const label = TYPE_LABEL[preview.type];
  const description = escapeHtml(preview.subtitle ?? `${label} compartido desde RestaurantApp`);
  const deepLink = `restaurantapp://import?share=${encodeURIComponent(preview.id)}`;
  const ogImage = preview.imageUrl ? escapeHtml(preview.imageUrl) : '';
  const stars = preview.rating ? '★'.repeat(preview.rating) + '☆'.repeat(5 - preview.rating) : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · RestaurantApp</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #dfe2cf; color: #333; }
  .card { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  .card img { width: 100%; height: 260px; object-fit: cover; display: block; }
  .body { padding: 20px 24px 28px; }
  .label { color: #905c36; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: .5px; }
  h1 { margin: 6px 0 4px; font-size: 24px; }
  .stars { color: #d9a441; font-size: 18px; }
  .sub { color: #666; margin: 8px 0 20px; }
  .open { display: inline-block; background: #93ae72; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; }
</style>
</head>
<body>
<div class="card">
  ${ogImage ? `<img src="${ogImage}" alt="${title}" />` : ''}
  <div class="body">
    <div class="label">${label}</div>
    <h1>${title}</h1>
    ${stars ? `<div class="stars">${stars}</div>` : ''}
    <p class="sub">${description}</p>
    <a class="open" href="${deepLink}">Abrir en la app</a>
  </div>
</div>
<noscript></noscript>
</body>
</html>`;
}
