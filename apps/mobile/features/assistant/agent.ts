import { runTool, toolSpecs } from '@/features/assistant/tools';
import { chatCompletion } from '@/services/api/ai';
import type { ChatMessage } from '@/services/api/ai';
import type { AppDatabase } from '@/services/db/types';

/**
 * Client-side agent loop (docs/07). The LLM lives behind the Worker; this loop
 * feeds it the tools, executes any tool calls locally against SQLite, and feeds
 * results back until the model answers. Orchestration is here (deterministic
 * TypeScript), so a small model only has to pick tools and phrase the reply.
 *
 * Needs the Worker /ai/chat to run end-to-end (verify per docs/13). The tool
 * execution it drives (runTool) is covered by tools.node.test.ts.
 */

export type { ChatMessage };

const MAX_TURNS = 5;

export interface AgentConfig {
  /**
   * El prompt de sistema con el contexto de la pasada (fecha, ubicación,
   * restaurantes cerca).
   *
   * `apiUrl` y `token` ya no están: los resolvía quien llamaba y se los pasaba
   * al agente, que es pedirle a la pantalla que sepa de sesiones y de URLs del
   * Worker. Ahora los resuelve `services/api`, que es de donde salen.
   */
  systemPrompt: string;
}

export async function runAssistant(
  db: AppDatabase,
  config: AgentConfig,
  history: ChatMessage[],
): Promise<{ messages: ChatMessage[]; answer: string }> {
  const messages: ChatMessage[] = [{ role: 'system', content: config.systemPrompt }, ...history];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // La llamada vive en services/api: aquí queda la orquestación, que es lo
    // propio de esta feature (docs/12 — solo services habla con la red).
    const data = await chatCompletion({ messages, tools: toolSpecs() });

    const toolCalls = data.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const answer = data.response ?? '';
      messages.push({ role: 'assistant', content: answer });
      return { messages, answer };
    }

    // Execute each tool locally and feed the results back.
    messages.push({ role: 'assistant', content: '' });
    for (const call of toolCalls) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = {};
      }
      const outcome = await runTool(db, call.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome),
      });
    }
  }

  return { messages, answer: 'No pude completar la consulta.' };
}
