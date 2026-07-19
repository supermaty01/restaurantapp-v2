import { Hono } from 'hono';

import type { AppContext } from '../types';

/**
 * AI proxy (docs/07). Only free Workers AI models, always through the AI Gateway
 * (caching + rate limiting + cost visibility). The app never holds an API key —
 * the AI binding authenticates by itself. Model ids are chosen in phase 7a from
 * the current catalogue; these are sensible defaults.
 *
 * Needs the AI binding + gateway to run (verify per docs/13).
 */

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const EMBED_MODEL = '@cf/baai/bge-m3';
const TRANSCRIBE_MODEL = '@cf/openai/whisper';

function gatewayOptions(gateway: string) {
  return gateway ? { gateway: { id: gateway } } : {};
}

export function aiRoutes() {
  const app = new Hono<AppContext>();

  // Chat with tool support (the client runs the agent loop; tools execute
  // locally against SQLite — docs/07).
  app.post('/ai/chat', async (c) => {
    const body = await c.req.json<{
      messages: { role: string; content: string }[];
      tools?: unknown[];
    }>();
    if (!Array.isArray(body?.messages)) return c.json({ error: 'invalid-body' }, 400);

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

    const result = await c.env.AI.run(
      EMBED_MODEL,
      { text: body.texts },
      gatewayOptions(c.env.AI_GATEWAY),
    );
    return c.json(result);
  });

  // Speech-to-text fallback (native STT is primary on device).
  app.post('/ai/transcribe', async (c) => {
    const audio = await c.req.arrayBuffer();
    if (audio.byteLength === 0) return c.json({ error: 'no-audio' }, 400);

    const result = await c.env.AI.run(
      TRANSCRIBE_MODEL,
      { audio: [...new Uint8Array(audio)] },
      gatewayOptions(c.env.AI_GATEWAY),
    );
    return c.json(result);
  });

  return app;
}
