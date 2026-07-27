import { workerFetch } from '@/services/api/worker';

/**
 * El proxy de IA del Worker, visto desde la app (docs/07).
 *
 * Solo el transporte. Quién decide qué mandar y qué hacer con la respuesta es el
 * bucle del agente, que vive en `features/assistant` y no necesita saber que
 * detrás hay HTTP.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ChatResponse {
  response?: string;
  tool_calls?: ToolCall[];
}

export async function chatCompletion(body: {
  messages: ChatMessage[];
  tools?: unknown[];
}): Promise<ChatResponse> {
  const response = await workerFetch('/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.json() as Promise<ChatResponse>;
}
