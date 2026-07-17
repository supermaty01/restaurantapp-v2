import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;
