#!/usr/bin/env node
/**
 * Applies every migration to a throwaway database inside the local Supabase
 * Postgres container, then runs the .test.sql files against it.
 *
 * The point is to exercise the real migration chain from zero — RLS policies,
 * triggers and security-definer functions included — which unit tests in the app
 * cannot reach. Requires `supabase start` to be running (docs/13).
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '..', 'migrations');
const DB = 'migcheck';

/** The db container name varies with the project directory, so discover it. */
function findContainer() {
  const names = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
  const match = names.split('\n').find((n) => n.startsWith('supabase_db_'));
  if (!match) {
    throw new Error(
      'No local Supabase database container found. Run `supabase start` first (docs/13).',
    );
  }
  return match.trim();
}

function psql(container, args, input) {
  // spawnSync, not execFileSync: psql writes RAISE NOTICE (i.e. the passing
  // checks) to stderr, and both streams are needed to report a run.
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', ...args], {
    input,
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function runFile(container, file, label) {
  const sql = readFileSync(file, 'utf8');
  const { ok, out } = psql(container, ['-d', DB, '-v', 'ON_ERROR_STOP=1', '-q'], sql);

  if (!ok) {
    console.error(`\n✖ ${label} failed:\n${out.trim()}`);
    return false;
  }

  const checks = out
    .split('\n')
    .filter((line) => line.includes('ok:'))
    .map((line) => `  ${line.replace(/^NOTICE:\s*ok:\s*/, '✓ ').trim()}`);
  if (checks.length) console.log(checks.join('\n'));
  return true;
}

const container = findContainer();
console.log(`Using ${container}`);

// A fresh database every run: a test that depends on leftovers proves nothing.
psql(container, ['-q', '-c', `drop database if exists ${DB} with (force)`]);
psql(container, ['-q', '-c', `create database ${DB}`]);

let ok = runFile(container, join(here, 'auth-stub.sql'), 'auth stub');

for (const name of readdirSync(migrationsDir).sort()) {
  if (!name.endsWith('.sql')) continue;
  ok = runFile(container, join(migrationsDir, name), name) && ok;
}

for (const name of readdirSync(here).sort()) {
  if (!name.endsWith('.test.sql')) continue;
  console.log(`\n── ${name}`);
  ok = runFile(container, join(here, name), name) && ok;
}

if (!ok) {
  console.error('\nSQL tests failed.');
  process.exit(1);
}
console.log('\nSQL tests passed.');
