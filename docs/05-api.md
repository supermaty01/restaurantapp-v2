# 05 — API (Cloudflare Worker)

## Alcance

El Worker (`apps/api`, Hono + TypeScript) existe **solo** para lo que el cliente no puede hacer directo contra Supabase con RLS. Todo lo demás (CRUD de sync, social, feed) va cliente→Supabase. Mantenerlo pequeño es una decisión de mantenibilidad, no una limitación.

Responsabilidades:

1. Share links (creación, resolución, preview web)
2. Proxy de IA con cuotas (chat, embeddings, speech-to-text)
3. Imágenes contra R2 (subida, lectura)
4. Tareas de mantenimiento (cron triggers: purgas, links expirados)

Autenticación: JWT de Supabase en `Authorization`, verificado en el Worker (JWKS cacheado). Endpoints públicos: solo la resolución/preview de share links.

## 1. Share links

Sustituye al archivo `.restoshare` como mecanismo de compartir (el archivo sobrevive solo como formato de backup, ver [09](09-migracion-datos.md)).

### Flujo

1. En la app: "Compartir" sobre un restaurante/plato/visita → `POST /share` → el Worker crea `share_links` (id corto tipo nanoid) y devuelve `https://<dominio>/s/abc123`.
2. Quien abre el link:
   - **Sin la app:** página web SSR del Worker con preview bonita (nombre, rating, fotos desde R2, mapa estático) + **OG tags** para que el unfurl en WhatsApp/Telegram se vea bien + botón "Abrir en la app".
   - **Con la app:** deep link / App Link intercepta → pantalla de importación nativa, que reutiliza la lógica de conflictos de la v1 (¿ya existe este restaurante? usar existente / crear nuevo).
3. `GET /share/:id/data` devuelve el JSON del contenido compartido (formato = schemas de `packages/shared`, evolución del `.restoshare`: mismo contenido, servido por red).

### Reglas

- El link es un **snapshot con referencia**: expone el estado actual de la entidad mientras no se revoque. Revocable y con expiración opcional desde la app.
- Compartir por link NO requiere que la entidad sea pública: el link es la capability. Sí requiere cuenta (el contenido debe estar sincronizado).
- Web mínima: HTML renderizado en el Worker, sin framework de frontend. Si algún día se quiere web-app real, será proyecto aparte.

## 2. Proxy de IA

Detalle funcional en [07](07-asistente-ia.md). **Decisión: solo modelos gratuitos de Workers AI, siempre vía AI Gateway.** Sin proveedores de pago, sin API keys de terceros (el binding `AI` autentica solo).

Contrato del Worker:

- `POST /ai/chat` — streaming, reenvía al modelo instruct con function calling del catálogo, con las tools que envía el cliente.
- `POST /ai/embed` — embeddings por lotes (modelo multilingüe del catálogo) para indexación local y pgvector.
- `POST /ai/transcribe` — audio → texto (Whisper) como fallback del STT nativo.
- **Cuotas en dos capas:** rate limiting del AI Gateway en el borde + presupuesto por usuario en `ai_usage` (Supabase) con hard-stop y mensaje claro. Caché del Gateway para que las repeticiones no consuman nada.
- Objetivo de factura: **$0**, dentro del free tier de neuronas.

## 3. Imágenes (R2)

- `POST /images/upload-url` → URL firmada de subida a R2 (`{user_id}/{image_id}.jpg`). La app comprime antes de subir.
- Lectura: URLs firmadas de corta duración, o público-cacheado solo para imágenes referenciadas por share links.
- Cron: garbage collection de objetos huérfanos (sin fila `images` viva).

## Límites free tier a vigilar

| Recurso | Free tier | Riesgo |
|---|---|---|
| Workers | 100k req/día | Bajo (uso personal) |
| R2 | 10 GB + operaciones | Medio: fotos. Mitigación: compresión agresiva + GC |
| Supabase DB | 500 MB, pausa por inactividad | Bajo en datos; la pausa se mitiga con el cron del Worker haciendo ping o aceptando el arranque frío |
| Workers AI | cuota diaria de neuronas | Medio: chat/embeddings/STT. Mitigación: caché y rate limiting del AI Gateway, batch de embeddings, cuota por usuario |

**Abierto:** dominio propio (necesario para App Links/Universal Links de share). Un dominio barato es el único gasto probable del proyecto (~$10/año) — alternativa: `*.workers.dev` + deep link por scheme, peor UX.
**Abierto:** rate limiting anónimo para la preview pública de share links.
