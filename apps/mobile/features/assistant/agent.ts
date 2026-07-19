import { runTool, toolSpecs } from '@/features/assistant/tools';
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatResponse {
  response?: string;
  tool_calls?: ToolCall[];
}

const MAX_TURNS = 5;

export interface AgentConfig {
  apiUrl: string;
  token: string;
  /** Extra context (date, location, nearby restaurants) for the system prompt. */
  systemPrompt: string;
}

export async function runAssistant(
  db: AppDatabase,
  config: AgentConfig,
  history: ChatMessage[],
): Promise<{ messages: ChatMessage[]; answer: string }> {
  const messages: ChatMessage[] = [{ role: 'system', content: config.systemPrompt }, ...history];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(`${config.apiUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ messages, tools: toolSpecs() }),
    });
    if (!res.ok) throw new Error(`ai/chat: ${res.status}`);
    const data = (await res.json()) as ChatResponse;

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
