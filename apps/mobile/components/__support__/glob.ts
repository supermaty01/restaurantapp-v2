import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', 'android', 'ios', '.expo', 'drizzle']);

/** Recursively lists files under `dir` whose name matches `pattern`. */
export function globSync(dir: string, pattern: RegExp): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...globSync(full, pattern));
    } else if (pattern.test(entry)) {
      found.push(full);
    }
  }

  return found;
}
