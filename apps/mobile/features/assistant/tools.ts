import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  countDishOccurrences,
  countVisitsWithPerson,
  lastVisitWithPerson,
  searchDishes,
  searchPeople,
  searchRestaurants,
} from '@/features/assistant/queries';
import type { AppDatabase } from '@/services/db/types';

/**
 * The assistant's read-only tools (docs/07). Each is a thin, well-typed wrapper
 * over a structured query. The LLM (behind the Worker) only chooses a tool and
 * fills its arguments; execution and the arithmetic happen locally against
 * SQLite. Descriptions are short on purpose — small models pick better with
 * fewer, clearer options.
 */

/** A tool with its parameter generic erased, for storage in one array. */
export interface AssistantTool {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (db: AppDatabase, args: unknown) => Promise<unknown>;
}

// The definition keeps the generic so `execute` is typed against the schema;
// `tool()` erases it (wrapping execute to accept `unknown`) so all tools share
// one array type without variance errors.
function tool<TParams extends z.ZodTypeAny>(def: {
  name: string;
  description: string;
  parameters: TParams;
  execute: (db: AppDatabase, args: z.infer<TParams>) => Promise<unknown>;
}): AssistantTool {
  return {
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    execute: (db, args) => def.execute(db, args as z.infer<TParams>),
  };
}

export const ASSISTANT_TOOLS: AssistantTool[] = [
  tool({
    name: 'count_dishes_eaten',
    description:
      'Cuenta cuántas veces se comió un plato, opcionalmente por restaurante y rango de fechas.',
    parameters: z.object({
      dishQuery: z.string().describe('Nombre o parte del nombre del plato'),
      restaurantQuery: z.string().optional().describe('Nombre o parte del restaurante'),
      from: z.string().optional().describe('Fecha inicial ISO (YYYY-MM-DD)'),
      to: z.string().optional().describe('Fecha final ISO (YYYY-MM-DD)'),
    }),
    execute: (db, args) => countDishOccurrences(db, args),
  }),
  tool({
    name: 'last_visit_with_person',
    description: 'Devuelve la última visita en la que se etiquetó a una persona.',
    parameters: z.object({
      personQuery: z.string().describe('Nombre o parte del nombre de la persona'),
    }),
    execute: (db, args) => lastVisitWithPerson(db, args.personQuery),
  }),
  tool({
    name: 'count_visits_with_person',
    description: 'Cuenta cuántas visitas incluyeron a una persona, opcionalmente por fechas.',
    parameters: z.object({
      personQuery: z.string(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
    execute: (db, args) =>
      countVisitsWithPerson(db, args.personQuery, { from: args.from, to: args.to }),
  }),
  tool({
    name: 'search_restaurants',
    description: 'Busca restaurantes por nombre para desambiguar.',
    parameters: z.object({ query: z.string() }),
    execute: (db, args) => searchRestaurants(db, args.query),
  }),
  tool({
    name: 'search_dishes',
    description: 'Busca platos por nombre para desambiguar.',
    parameters: z.object({ query: z.string() }),
    execute: (db, args) => searchDishes(db, args.query),
  }),
  tool({
    name: 'search_people',
    description: 'Busca personas por nombre para desambiguar.',
    parameters: z.object({ query: z.string() }),
    execute: (db, args) => searchPeople(db, args.query),
  }),
];

const BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

/**
 * Validates a tool call's arguments with zod and runs it. Invalid arguments are
 * returned as an error object for the model to correct, never thrown at the UI.
 */
export async function runTool(
  db: AppDatabase,
  name: string,
  rawArgs: unknown,
): Promise<{ result: unknown } | { error: string }> {
  const t = BY_NAME.get(name);
  if (!t) return { error: `Herramienta desconocida: ${name}` };

  const parsed = t.parameters.safeParse(rawArgs);
  if (!parsed.success) return { error: `Argumentos inválidos: ${parsed.error.message}` };

  const result = await t.execute(db, parsed.data);
  return { result };
}

/** Tool schemas in the shape the chat API expects (JSON Schema per tool). */
export function toolSpecs() {
  return ASSISTANT_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters, { target: 'openApi3' }),
    },
  }));
}
