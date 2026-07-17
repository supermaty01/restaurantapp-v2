import type * as schema from './schema';
import type { drizzle } from 'drizzle-orm/expo-sqlite';

export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;
