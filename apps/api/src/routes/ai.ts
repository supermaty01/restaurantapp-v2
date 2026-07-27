import { Hono } from 'hono';

import type { AppContext } from '../types';

/**
 * AI proxy (docs/07). Only free Workers AI models, always through the AI Gateway
 * (caching + rate limiting + cost visibility) cuando está configurado. The app
 * never holds an API key — the AI binding authenticates by itself.
 *
 * Needs the AI binding + gateway to run (verify per docs/13).
 */

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const EMBED_MODEL = '@cf/baai/bge-m3';
const TRANSCRIBE_MODEL = '@cf/openai/whisper';

/**
 * Los topes.
 *
 * La cabecera de este fichero decía que el AI Gateway pone el límite de uso. Y
 * lo pondría, salvo que `AI_GATEWAY` viene **vacío** por defecto en
 * `wrangler.toml` y `gatewayOptions` devuelve `{}` cuando lo está: el único
 * control de coste del proyecto era opcional y venía apagado.
 *
 * Estos topes no sustituyen al gateway. Existen para que su ausencia signifique
 * "sin caché ni métricas" y no "ilimitado".
 */
const MAX_MESSAGES = 40;
const MAX_CHARS = 24_000;
const MAX_TEXTS = 100;
const MAX_TEXT_CHARS = 8_000;
/** 10 MB de audio: Whisper no admite mucho más de un rato de voz. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function gatewayOptions(gateway: string) {
  return gateway ? { gateway: { id: gateway } } : {};
}

const ROLES = new Set(['system', 'user', 'assistant', 'tool']);

export function aiRoutes() {
  const app = new Hono<AppContext>();

  // Chat with tool support (the client runs the agent loop; tools execute
  // locally against SQLite — docs/07).
  app.post('/ai/chat', async (c) => {
    const body = await c.req.json<{
      messages: { role: string; content: string }[];
      tools?: unknown[];
    }>();

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return c.json({ error: 'invalid-body' }, 400);
    }
    if (body.messages.length > MAX_MESSAGES) return c.json({ error: 'too-many-messages' }, 413);

    // La forma de cada mensaje, no solo la del array. `Array.isArray` dejaba
    // pasar `[{}]`, `[null]` y cualquier cosa que el modelo tuviera que digerir.
    let total = 0;
    for (const message of body.messages) {
      if (typeof message?.role !== 'string' || !ROLES.has(message.role)) {
        return c.json({ error: 'invalid-role' }, 400);
      }
      if (typeof message.content !== 'string') return c.json({ error: 'invalid-content' }, 400);
      total += message.content.length;
    }
    if (total > MAX_CHARS) return c.json({ error: 'too-large' }, 413);

    const result = await c.env.AI.run(
      CHAT_MODEL,
      { messages: body.messages, tools: body.tools },
      gatewayOptions(c.env.AI_GATEWAY),
    );
    return c.json(result);
  });

  // Batch embeddings for local semantic search indexing.
  app.post('/ai/embed', async (c) => {
    const body = await c.req.json<{ texts: string[] }>();
    if (!Array.isArray(body?.texts) || body.texts.length === 0) {
      return c.json({ error: 'invalid-body' }, 400);
    }
    if (body.texts.length > MAX_TEXTS) return c.json({ error: 'too-many-texts' }, 413);
    if (!body.texts.every((text) => typeof text === 'string' && text.length <= MAX_TEXT_CHARS)) {
      return c.json({ error: 'invalid-texts' }, 400);
    }

    const result = await c.env.AI.run(
      EMBED_MODEL,
      { text: body.texts },
      gatewayOptions(c.env.AI_GATEWAY),
    );
    return c.json(result);
  });

  // Speech-to-text fallback (native STT is primary on device).
  app.post('/ai/transcribe', async (c) => {
    const declared = Number(c.req.header('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
      return c.json({ error: 'too-large' }, 413);
    }

    const audio = await c.req.arrayBuffer();
    if (audio.byteLength === 0) return c.json({ error: 'no-audio' }, 400);
    if (audio.byteLength > MAX_AUDIO_BYTES) return c.json({ error: 'too-large' }, 413);

    /**
     * `Array.from` sobre la vista, no `[...new Uint8Array(audio)]`.
     *
     * Los dos acaban en un array de números, pero el spread construye además el
     * iterador y una lista intermedia. Sin el tope de arriba, un audio de unos
     * pocos megas eran millones de elementos por partida doble contra los 128 MB
     * del Worker: la petición no fallaba con un error, se moría. El tope es la
     * mitad del arreglo; esto es la otra.
     */
    const result = await c.env.AI.run(
      TRANSCRIBE_MODEL,
      { audio: Array.from(new Uint8Array(audio)) },
      gatewayOptions(c.env.AI_GATEWAY),
    );
    return c.json(result);
  });

  return app;
}
