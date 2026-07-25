#!/usr/bin/env node
/**
 * Runs the .test.sql files against the real migration chain.
 *
 * Each test file gets its **own** database, built from zero: drop, create, load
 * the auth stub, apply every migration in order, load the shared helpers, then
 * run the file. That is slower than sharing one database, but a suite where one
 * file's fixtures leak into the next one's counts is a suite that fails for
 * reasons unrelated to the code — and worse, can pass for them too.
 *
 * This exercises what app-level unit tests cannot reach: RLS policies, triggers
 * and security-definer functions, as Postgres actually executes them. Requires
 * `supabase start` to be running (docs/13).
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

function runFile(container, file, label, { quiet = false } = {}) {
  const { ok, out } = psql(
    container,
    ['-d', DB, '-v', 'ON_ERROR_STOP=1', '-q'],
    readFileSync(file, 'utf8'),
  );

  if (!ok) {
    console.error(`\n✖ ${label} failed:\n${out.trim()}`);
    return false;
  }

  if (!quiet) {
    const checks = out
      .split('\n')
      .filter((line) => line.includes('ok:'))
      .map((line) => `  ${line.replace(/^NOTICE:\s*ok:\s*/, '✓ ').trim()}`);
    if (checks.length) console.log(checks.join('\n'));
  }
  return true;
}

/** Rebuilds the schema from scratch. Returns false if any migration fails. */
function freshDatabase(container) {
  psql(container, ['-q', '-c', `drop database if exists ${DB} with (force)`]);
  psql(container, ['-q', '-c', `create database ${DB}`]);

  let ok = runFile(container, join(here, 'auth-stub.sql'), 'auth stub', { quiet: true });

  for (const name of readdirSync(migrationsDir).sort()) {
    if (!name.endsWith('.sql')) continue;
    ok = runFile(container, join(migrationsDir, name), name, { quiet: true }) && ok;
  }

  return runFile(container, join(here, 'helpers.sql'), 'helpers', { quiet: true }) && ok;
}

const container = findContainer();
console.log(`Using ${container}`);

const testFiles = readdirSync(here)
  .filter((name) => name.endsWith('.test.sql'))
  .sort();

if (testFiles.length === 0) {
  console.error('No .test.sql files found.');
  process.exit(1);
}

let ok = true;
for (const name of testFiles) {
  console.log(`\n── ${name}`);
  if (!freshDatabase(container)) {
    ok = false;
    continue;
  }
  ok = runFile(container, join(here, name), name) && ok;
}

if (!ok) {
  console.error('\nSQL tests failed.');
  process.exit(1);
}
console.log('\nSQL tests passed.');
